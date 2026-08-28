import asyncio
from collections import defaultdict
from typing import Any

from src.agent.research.config import research_settings
from src.agent.research.retrieval.reranker import ResearchReranker
from src.rag.retriever import RAGRetriever


def source_key(source: dict[str, Any]) -> str:
    document_id = source.get("document_id")
    chunk_index = source.get("chunk_index")
    if document_id is not None and chunk_index is not None:
        return f"document:{document_id}:{chunk_index}"
    chunk_id = source.get("chunk_id")
    if chunk_id is not None:
        return f"chunk:{chunk_id}"
    return f"text:{hash(source.get('text', ''))}"


def reciprocal_rank_fusion(
    batches: list[tuple[str, list[dict[str, Any]]]],
) -> list[dict[str, Any]]:
    combined: dict[str, dict[str, Any]] = {}
    contributions: defaultdict[str, float] = defaultdict(float)
    methods: defaultdict[str, set[str]] = defaultdict(set)
    for method, batch in batches:
        for rank, source in enumerate(batch, start=1):
            identity = source_key(source)
            contributions[identity] += 1 / (60 + rank)
            methods[identity].add(method)
            current = combined.get(identity)
            if current is None or source.get("score", 0.0) > current.get("score", 0.0):
                combined[identity] = dict(source)
    if not combined:
        return []
    maximum = max(contributions.values())
    fused = []
    for identity, source in combined.items():
        fused.append({
            **source,
            "fusion_score": contributions[identity] / maximum if maximum else 0.0,
            "retrieval_methods": sorted(methods[identity]),
        })
    return sorted(fused, key=lambda item: item["fusion_score"], reverse=True)


class HybridResearchRetriever:
    def __init__(
        self,
        vector_retriever: RAGRetriever,
        lexical_retriever=None,
        reranker: ResearchReranker | None = None,
    ):
        self.vector_retriever = vector_retriever
        self.lexical_retriever = lexical_retriever
        self.reranker = reranker or ResearchReranker()

    async def retrieve(
        self,
        question: str,
        queries: list[str],
        space_id: str,
        top_k: int = research_settings.rerank_top_k,
    ) -> list[dict[str, Any]]:
        unique_queries = list(dict.fromkeys(query for query in queries if query.strip()))
        vector_tasks = [
            self.vector_retriever.retrieve(
                query=query,
                top_k=research_settings.vector_candidate_k,
                score_threshold=0.0,
                filter_dict={"space_id": space_id},
            )
            for query in unique_queries
        ]
        lexical_tasks = [
            self.lexical_retriever.search(
                query=query,
                space_id=space_id,
                top_k=research_settings.lexical_candidate_k,
            )
            for query in unique_queries
        ] if self.lexical_retriever else []
        results = await asyncio.gather(*vector_tasks, *lexical_tasks, return_exceptions=True)
        batches: list[tuple[str, list[dict[str, Any]]]] = []
        for result in results[:len(vector_tasks)]:
            if not isinstance(result, Exception):
                batches.append(("vector", result))
        for result in results[len(vector_tasks):]:
            if not isinstance(result, Exception):
                batches.append(("lexical", result))
        candidates = reciprocal_rank_fusion(batches)
        return await self.reranker.rerank(question, candidates, top_k)
