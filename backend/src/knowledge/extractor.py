import json
import re
from typing import Any, Iterable, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.core.config import settings
from src.core.logging import logger

ALLOWED_RELATIONS = {"prerequisite_of", "part_of", "related_to", "uses"}
EXTRACTION_BATCH_SIZE = 8
MAX_CHUNK_CHARS = 5000


class ExtractedConcept(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    summary: str = Field(default="", max_length=2000)
    difficulty: int = Field(default=1, ge=1, le=5)
    source_chunk_ids: list[str] = Field(default_factory=list)


class ExtractedRelation(BaseModel):
    source: str = Field(min_length=1, max_length=240)
    target: str = Field(min_length=1, max_length=240)
    relation: Literal["prerequisite_of", "part_of", "related_to", "uses"]


class KnowledgeExtraction(BaseModel):
    concepts: list[ExtractedConcept] = Field(default_factory=list)
    relations: list[ExtractedRelation] = Field(default_factory=list)


def _json_payload(value: str) -> dict[str, Any]:
    cleaned = value.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned, re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Knowledge extraction did not return a JSON object.")
    payload = json.loads(cleaned[start:end + 1])
    if not isinstance(payload, dict):
        raise ValueError("Knowledge extraction root must be an object.")
    return payload


class ConceptExtractor:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client if client is not None else (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        )

    @staticmethod
    def parse(value: str, allowed_chunk_ids: set[str] | None = None) -> KnowledgeExtraction:
        payload = _json_payload(value)
        allowed = allowed_chunk_ids or set()
        concepts: list[ExtractedConcept] = []
        for raw in payload.get("concepts", []):
            if not isinstance(raw, dict) or not str(raw.get("name", "")).strip():
                continue
            sources = [str(item) for item in raw.get("source_chunk_ids", [])]
            if allowed:
                sources = [item for item in sources if item in allowed]
            if allowed and not sources:
                continue
            try:
                concepts.append(ExtractedConcept(
                    name=" ".join(str(raw["name"]).split()),
                    summary=str(raw.get("summary", "")).strip(),
                    difficulty=max(1, min(5, int(raw.get("difficulty", 1)))),
                    source_chunk_ids=sources,
                ))
            except (TypeError, ValueError):
                continue

        names = {item.name.casefold() for item in concepts}
        relations: list[ExtractedRelation] = []
        for raw in payload.get("relations", []):
            if not isinstance(raw, dict):
                continue
            source = " ".join(str(raw.get("source", "")).split())
            target = " ".join(str(raw.get("target", "")).split())
            relation = str(raw.get("relation", ""))
            if (
                source.casefold() in names
                and target.casefold() in names
                and source.casefold() != target.casefold()
                and relation in ALLOWED_RELATIONS
            ):
                relations.append(ExtractedRelation(source=source, target=target, relation=relation))
        return KnowledgeExtraction(concepts=concepts, relations=relations)

    @staticmethod
    def merge(results: Iterable[KnowledgeExtraction]) -> KnowledgeExtraction:
        concepts: dict[str, ExtractedConcept] = {}
        relations: dict[tuple[str, str, str], ExtractedRelation] = {}
        for result in results:
            for item in result.concepts:
                key = item.name.casefold()
                current = concepts.get(key)
                if current is None:
                    concepts[key] = item.model_copy(deep=True)
                else:
                    current.source_chunk_ids = sorted(set(current.source_chunk_ids + item.source_chunk_ids))
                    if len(item.summary) > len(current.summary):
                        current.summary = item.summary
                    current.difficulty = max(current.difficulty, item.difficulty)
            for edge in result.relations:
                relations[(edge.source.casefold(), edge.target.casefold(), edge.relation)] = edge
        valid_names = set(concepts)
        return KnowledgeExtraction(
            concepts=list(concepts.values()),
            relations=[
                edge for (source, target, _), edge in relations.items()
                if source in valid_names and target in valid_names
            ],
        )

    async def extract(self, chunks: list[Any]) -> KnowledgeExtraction:
        if not chunks or self._client is None:
            if chunks and self._client is None:
                logger.warning("Skipping knowledge extraction because OPENAI_API_KEY is not set.")
            return KnowledgeExtraction()

        results: list[KnowledgeExtraction] = []
        for offset in range(0, len(chunks), EXTRACTION_BATCH_SIZE):
            batch = chunks[offset:offset + EXTRACTION_BATCH_SIZE]
            chunk_map = {}
            for chunk in batch:
                if isinstance(chunk, dict):
                    chunk_id, content = chunk.get("id"), chunk.get("content", "")
                else:
                    chunk_id, content = getattr(chunk, "id"), getattr(chunk, "content", "")
                chunk_map[str(chunk_id)] = str(content)[:MAX_CHUNK_CHARS]
            material = "\n\n".join(
                f"[chunk_id={chunk_id}]\n{text}" for chunk_id, text in chunk_map.items()
            )
            response = await self._client.chat.completions.create(
                model=self.model_name,
                response_format={"type": "json_object"},
                temperature=0,
                messages=[
                    {"role": "system", "content": (
                        "Extract a lightweight learning knowledge graph. Return JSON with concepts "
                        "and relations only. Each concept must include name, concise summary, "
                        "difficulty from 1 to 5, and source_chunk_ids copied exactly from the input. "
                        "Relations may only be prerequisite_of, part_of, related_to, or uses. "
                        "Do not invent concepts unsupported by the material."
                    )},
                    {"role": "user", "content": material},
                ],
            )
            content = response.choices[0].message.content or "{}"
            results.append(self.parse(content, set(chunk_map)))
        return self.merge(results)


concept_extractor = ConceptExtractor()
