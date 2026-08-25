import asyncio

import pytest

from src.agent.research.nodes.retrieve_local import (
    LOCAL_TOP_K_PER_QUESTION,
    LocalResearchRetriever,
)
from src.agent.research.state import ResearchState


class FakeRetriever:
    def __init__(self):
        self.calls = []
        self.active = 0
        self.max_active = 0

    async def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0)
        self.active -= 1
        suffix = "shared" if kwargs["query"] == "question one" else "second"
        return [{
            "chunk_id": suffix,
            "score": 0.8,
            "text": f"Evidence for {kwargs['query']}",
            "source": "notes.pdf",
            "document_id": "document-1",
            "chunk_index": 2,
        }]


@pytest.mark.asyncio
async def test_local_retrieval_is_parallel_and_space_isolated():
    retriever = FakeRetriever()
    state = ResearchState(
        query="research",
        space_id="space-42",
        research_questions=["question one", "question two"],
    )

    await LocalResearchRetriever(rag_retriever=retriever).run(state)

    assert len(retriever.calls) == 2
    assert retriever.max_active == 2
    assert all(call["filter_dict"] == {"space_id": "space-42"} for call in retriever.calls)
    assert all(call["top_k"] == LOCAL_TOP_K_PER_QUESTION for call in retriever.calls)
    assert {source["source_type"] for source in state.local_sources} == {"local"}


@pytest.mark.asyncio
async def test_local_retrieval_skips_when_space_is_absent():
    retriever = FakeRetriever()
    state = ResearchState(query="research", research_questions=["question"])

    await LocalResearchRetriever(rag_retriever=retriever).run(state)

    assert retriever.calls == []
    assert state.local_sources == []


class DuplicateRetriever:
    async def retrieve(self, **kwargs):
        return [{
            "chunk_id": "same-chunk",
            "score": 0.7 if kwargs["query"] == "one" else 0.9,
            "text": kwargs["query"],
            "source": "book.pdf",
            "document_id": "document-1",
            "chunk_index": 1,
        }]


@pytest.mark.asyncio
async def test_local_retrieval_deduplicates_chunk_and_keeps_best_score():
    state = ResearchState(
        query="research",
        space_id="space-1",
        research_questions=["one", "two"],
    )

    await LocalResearchRetriever(rag_retriever=DuplicateRetriever()).run(state)

    assert len(state.local_sources) == 1
    assert state.local_sources[0]["score"] == 0.9
    assert state.local_sources[0]["research_questions"] == ["one", "two"]
