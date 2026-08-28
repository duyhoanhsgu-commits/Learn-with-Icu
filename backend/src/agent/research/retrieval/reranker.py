"""Provider-neutral reranking interface with a deterministic local fallback."""

import re
from typing import Any, Protocol

_WORD_PATTERN = re.compile(r"\w+", flags=re.UNICODE)


def _terms(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _WORD_PATTERN.findall(value)
        if len(token) >= 3
    }


class RerankProvider(Protocol):
    async def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]: ...


class ResearchReranker:
    def __init__(self, provider: RerankProvider | None = None):
        self.provider = provider

    @staticmethod
    def fallback(
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]:
        query_terms = _terms(query)
        ranked: list[tuple[float, int, dict[str, Any]]] = []
        for index, candidate in enumerate(candidates):
            text = candidate.get("text", "")
            text_terms = _terms(text)
            overlap = len(query_terms & text_terms) / max(1, len(query_terms))
            phrase = 1.0 if query.casefold() in text.casefold() else 0.0
            retrieval_score = float(candidate.get("fusion_score", candidate.get("score", 0.0)))
            available = [overlap, retrieval_score]
            if phrase:
                available.append(phrase)
            relevance = sum(available) / len(available)
            ranked.append((relevance, -index, {
                **candidate,
                "relevance_score": round(relevance, 6),
            }))
        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return [item[2] for item in ranked[:top_k]]

    async def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]:
        if self.provider:
            try:
                return await self.provider.rerank(query, candidates, top_k)
            except Exception:
                pass
        return self.fallback(query, candidates, top_k)
