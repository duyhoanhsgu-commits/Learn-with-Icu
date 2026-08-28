from types import SimpleNamespace

import pytest

from src.agent.research.retrieval.hybrid import HybridResearchRetriever
from src.agent.research.retrieval.lexical_search import bm25_rank, build_lexical_statement
from src.agent.research.retrieval.reranker import ResearchReranker


class FakeVectorRetriever:
    def __init__(self):
        self.calls = []

    async def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        return [
            {
                "chunk_id": "vector-shared",
                "document_id": "doc-1",
                "chunk_index": 0,
                "source": "paper.pdf",
                "text": "Self attention has quadratic sequence complexity.",
                "score": 0.88,
            },
            {
                "chunk_id": "vector-only",
                "document_id": "doc-1",
                "chunk_index": 1,
                "source": "paper.pdf",
                "text": "Unrelated historical background.",
                "score": 0.7,
            },
        ]


class FakeLexicalRetriever:
    def __init__(self):
        self.calls = []

    async def search(self, **kwargs):
        self.calls.append(kwargs)
        return [
            {
                "chunk_id": "db-shared",
                "document_id": "doc-1",
                "chunk_index": 0,
                "source": "paper.pdf",
                "text": "Self attention has quadratic sequence complexity.",
                "score": 1.0,
            },
            {
                "chunk_id": "lexical-only",
                "document_id": "doc-2",
                "chunk_index": 4,
                "source": "notes.pdf",
                "text": "Attention memory grows with sequence length.",
                "score": 0.8,
            },
        ]


@pytest.mark.asyncio
async def test_hybrid_retrieval_fuses_sources_and_enforces_space_filter():
    vector = FakeVectorRetriever()
    lexical = FakeLexicalRetriever()
    hybrid = HybridResearchRetriever(vector, lexical, ResearchReranker())

    results = await hybrid.retrieve(
        question="Why is self attention expensive?",
        queries=["self attention complexity"],
        space_id="space-42",
        top_k=3,
    )

    shared = next(item for item in results if item["document_id"] == "doc-1" and item["chunk_index"] == 0)
    assert shared["retrieval_methods"] == ["lexical", "vector"]
    assert vector.calls[0]["filter_dict"] == {"space_id": "space-42"}
    assert lexical.calls[0]["space_id"] == "space-42"
    assert all("relevance_score" in item for item in results)


def test_lexical_statement_and_bm25_are_space_scoped_and_rank_relevance():
    statement = build_lexical_statement("attention complexity", "space-safe")
    assert "documents.space_id" in str(statement)
    assert "space-safe" in statement.compile().params.values()
    rows = [
        (SimpleNamespace(id="1", document_id="d1", chunk_index=0, content="gardening soil water"), "a.pdf"),
        (SimpleNamespace(id="2", document_id="d1", chunk_index=1, content="attention complexity is quadratic"), "a.pdf"),
    ]

    ranked = bm25_rank("attention complexity", rows, top_k=1)

    assert ranked[0]["chunk_id"] == "2"
