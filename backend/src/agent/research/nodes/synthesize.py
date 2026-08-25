import re
from typing import Any

from openai import AsyncOpenAI

from src.agent.research.prompts import SYNTHESIZE_SYSTEM_PROMPT, SYNTHESIZE_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger

_CITATION_PATTERN = re.compile(r"\[(\d+)\]")


def source_identity(evidence: dict[str, Any]) -> tuple[str, str]:
    if evidence.get("source_type") == "web":
        return "web", evidence.get("url", "")
    return "local", str(evidence.get("chunk_id") or (
        evidence.get("document_id"), evidence.get("chunk_index")
    ))


def build_source_catalog(
    evidence: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    source_numbers: dict[tuple[str, str], int] = {}
    sources: list[dict[str, Any]] = []
    numbered_evidence: list[dict[str, Any]] = []
    for item in evidence:
        identity = source_identity(item)
        if identity not in source_numbers:
            source_numbers[identity] = len(sources) + 1
            sources.append({
                "chunk_id": item.get("chunk_id"),
                "score": float(item.get("score", 0.0)),
                "text": item.get("evidence", ""),
                "source": item.get("source", "Unknown source"),
                "document_id": item.get("document_id"),
                "chunk_index": item.get("chunk_index"),
                "url": item.get("url"),
                "source_type": item.get("source_type", "web"),
            })
        numbered_evidence.append({
            **item,
            "source_number": source_numbers[identity],
        })
    return sources, numbered_evidence


def source_label(number: int, source: dict[str, Any]) -> str:
    if source.get("url"):
        return f"[{number}] {source['source']} — {source['url']}"
    chunk = source.get("chunk_index")
    chunk_label = f"chunk {chunk + 1}" if isinstance(chunk, int) else "uploaded document"
    return f"[{number}] {source['source']} — {chunk_label}"


class ResearchSynthesizer:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        if client is False:
            self._client = None
        else:
            self._client = client or (
                AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                if settings.OPENAI_API_KEY
                else None
            )

    @staticmethod
    def fallback_report(
        state: ResearchState,
        sources: list[dict[str, Any]],
        numbered_evidence: list[dict[str, Any]],
    ) -> str:
        findings = "\n".join(
            f"- {item.get('claim') or item.get('evidence')} [{item['source_number']}]"
            for item in numbered_evidence
        ) or "- No grounded evidence was available."
        details = "\n\n".join(
            f"**{item.get('research_question', 'Finding')}** — {item.get('evidence')} "
            f"[{item['source_number']}]"
            for item in numbered_evidence
        ) or "The available sources did not provide enough evidence for detailed analysis."
        limitations = (
            ", ".join(state.missing_topics)
            if state.missing_topics
            else "No specific missing topic was identified, but this fallback report has not performed additional interpretation."
        )
        source_lines = "\n".join(
            source_label(index, source)
            for index, source in enumerate(sources, start=1)
        ) or "No sources available."
        return f"""# Summary

The report below summarizes the grounded evidence collected for: {state.query}

# Key Findings

{findings}

# Detailed Analysis

{details}

# Comparison

The evidence above should be compared only on the dimensions explicitly supported by the cited excerpts.

# Limitations / Uncertainty

{limitations}

# Sources

{source_lines}"""

    async def synthesize(self, state: ResearchState) -> tuple[str, list[dict[str, Any]]]:
        sources, numbered_evidence = build_source_catalog(state.evidence)
        fallback = self.fallback_report(state, sources, numbered_evidence)
        if not self._client or not numbered_evidence:
            return fallback, sources
        evidence_text = "\n\n".join(
            f"[Source {item['source_number']}: "
            f"{source_label(item['source_number'], sources[item['source_number'] - 1])}]\n"
            f"Research question: {item.get('research_question')}\n"
            f"Claim: {item.get('claim')}\n"
            f"Evidence excerpt: {item.get('evidence')}"
            for item in numbered_evidence
        )
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYNTHESIZE_SYSTEM_PROMPT},
                    {"role": "user", "content": SYNTHESIZE_USER_PROMPT.format(
                        query=state.query,
                        evidence=evidence_text,
                        limitations="\n".join(f"- {item}" for item in state.missing_topics) or "None identified",
                    )},
                ],
                temperature=0.2,
            )
            report = response.choices[0].message.content or ""
            citations = {int(value) for value in _CITATION_PATTERN.findall(report)}
            if (
                not report.strip()
                or not citations
                or any(number < 1 or number > len(sources) for number in citations)
            ):
                logger.warning("Research synthesis returned an invalid citation; using grounded fallback.")
                return fallback, sources
            return report, sources
        except Exception as exc:
            logger.warning(f"Research synthesis failed; using grounded fallback: {exc}")
            return fallback, sources

    async def run(self, state: ResearchState) -> ResearchState:
        state.progress("research.synthesize", "Synthesizing research report")
        state.report, state.sources = await self.synthesize(state)
        state.progress(
            "research.done",
            "Research report complete",
            answer=state.report,
            sources=state.sources,
        )
        return state


async def synthesize_node(
    state: ResearchState,
    synthesizer: ResearchSynthesizer,
) -> ResearchState:
    return await synthesizer.run(state)
