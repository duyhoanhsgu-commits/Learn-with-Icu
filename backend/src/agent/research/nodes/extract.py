import re
from typing import Any

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator

from src.agent.research.prompts import EXTRACT_SYSTEM_PROMPT, EXTRACT_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger
from src.ingestion.chunker import TextChunker

MAX_RELEVANT_CHUNKS_PER_QUESTION = 3
MAX_EVIDENCE_PER_SOURCE = 4
_WORD_PATTERN = re.compile(r"\w+", flags=re.UNICODE)


def normalized_text(value: str) -> str:
    return " ".join(value.casefold().split())


def content_terms(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _WORD_PATTERN.findall(value)
        if len(token) >= 3
    }


def rank_relevant_chunks(
    chunks: list[str],
    question: str,
    limit: int = MAX_RELEVANT_CHUNKS_PER_QUESTION,
) -> list[str]:
    terms = content_terms(question)
    ranked = []
    for index, chunk in enumerate(chunks):
        chunk_terms = content_terms(chunk)
        overlap = len(terms & chunk_terms)
        density = overlap / max(1, len(terms))
        ranked.append((overlap, density, -index, chunk))
    ranked.sort(reverse=True)
    relevant = [item[3] for item in ranked if item[0] > 0][:limit]
    return relevant or chunks[:1]


class EvidenceCandidate(BaseModel):
    claim: str = Field(min_length=1, max_length=500)
    evidence: str = Field(min_length=1, max_length=1600)
    research_question: str = Field(min_length=1, max_length=500)

    @field_validator("claim", "evidence", "research_question")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split()).strip()


class EvidenceBatch(BaseModel):
    evidence: list[EvidenceCandidate] = Field(default_factory=list, max_length=MAX_EVIDENCE_PER_SOURCE)


class EvidenceExtractor:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY
            else None
        )
        self.chunker = TextChunker(chunk_size=350, chunk_overlap=50)

    def relevant_sections(self, source: dict[str, Any]) -> dict[str, list[str]]:
        chunks = self.chunker.split_text(source.get("text", ""))
        return {
            question: rank_relevant_chunks(chunks, question)
            for question in source.get("research_questions", [])
            if question.strip()
        }

    @staticmethod
    def fallback_candidates(sections: dict[str, list[str]]) -> list[EvidenceCandidate]:
        candidates: list[EvidenceCandidate] = []
        for question, chunks in sections.items():
            if not chunks:
                continue
            excerpt = " ".join(chunks[0].split())[:1000]
            if not excerpt:
                continue
            first_sentence = re.split(r"(?<=[.!?])\s+", excerpt, maxsplit=1)[0]
            candidates.append(EvidenceCandidate(
                claim=first_sentence[:500],
                evidence=excerpt,
                research_question=question,
            ))
            if len(candidates) >= MAX_EVIDENCE_PER_SOURCE:
                break
        return candidates

    async def extract_source(self, source: dict[str, Any]) -> list[dict[str, Any]]:
        sections = self.relevant_sections(source)
        if not sections:
            return []
        selected_text = "\n\n".join(
            f"[For: {question}]\n" + "\n\n".join(chunks)
            for question, chunks in sections.items()
        )
        grounding_text = "\n\n".join(
            chunk
            for chunks in sections.values()
            for chunk in chunks
        )
        candidates: list[EvidenceCandidate]
        if not self._client:
            candidates = self.fallback_candidates(sections)
        else:
            try:
                response = await self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": EXTRACT_SYSTEM_PROMPT},
                        {"role": "user", "content": EXTRACT_USER_PROMPT.format(
                            research_questions="\n".join(f"- {question}" for question in sections),
                            source_text=selected_text,
                            max_evidence=MAX_EVIDENCE_PER_SOURCE,
                        )},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0,
                )
                batch = EvidenceBatch.model_validate_json(
                    response.choices[0].message.content or "{}"
                )
                candidates = batch.evidence
            except Exception as exc:
                logger.warning(f"Evidence extraction failed for {source.get('url') or source.get('source')}: {exc}")
                candidates = self.fallback_candidates(sections)

        allowed_questions = set(sections)
        normalized_source = normalized_text(grounding_text)
        evidence: list[dict[str, Any]] = []
        for candidate in candidates:
            if candidate.research_question not in allowed_questions:
                continue
            if normalized_text(candidate.evidence) not in normalized_source:
                logger.warning("Discarded evidence excerpt that was not present in source text.")
                continue
            item = {
                "claim": candidate.claim,
                "evidence": candidate.evidence,
                "source": source.get("title") or source.get("source", "Unknown source"),
                "research_question": candidate.research_question,
                "source_type": source.get("source_type", "web"),
            }
            for key in (
                "url",
                "document_id",
                "chunk_id",
                "chunk_index",
                "space_id",
                "score",
                "relevance_score",
                "source_quality_score",
                "retrieval_methods",
            ):
                if source.get(key) is not None:
                    item[key] = source[key]
            evidence.append(item)
        return evidence

    async def run(self, state: ResearchState) -> ResearchState:
        pending_sources = [
            source for source in [*state.web_sources, *state.local_sources]
            if not source.get("extracted")
        ]
        state.progress(
            "research.extract",
            "Extracting relevant evidence",
            current=0,
            total=len(pending_sources),
        )
        known = {
            (
                item.get("source_type"),
                item.get("url") or item.get("chunk_id"),
                item.get("research_question"),
                normalized_text(item.get("evidence", "")),
            )
            for item in state.evidence
        }
        for source in pending_sources:
            for item in await self.extract_source(source):
                key = (
                    item.get("source_type"),
                    item.get("url") or item.get("chunk_id"),
                    item.get("research_question"),
                    normalized_text(item.get("evidence", "")),
                )
                if key not in known:
                    state.evidence.append(item)
                    known.add(key)
            source["extracted"] = True
        return state


async def extract_node(state: ResearchState, extractor: EvidenceExtractor) -> ResearchState:
    return await extractor.run(state)
