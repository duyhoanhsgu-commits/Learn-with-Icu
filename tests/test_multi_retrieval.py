import asyncio

import pytest

from src.rag.pipeline import RAGPipeline
from src.rag.query_planner import QueryPlan


def context(chunk_id, score, text=None):
    return {
        "chunk_id": chunk_id,
        "score": score,
        "text": text or f"text-{chunk_id}",
        "source": "notes.pdf",
        "document_id": "document-1",
        "chunk_index": ord(chunk_id) - ord("A"),
    }


class FakePlanner:
    def __init__(self, plan):
        self.plan_result = plan
        self.calls = []

    async def plan(self, query):
        self.calls.append(query)
        return self.plan_result


class FakeRetriever:
    def __init__(self, results):
        self.results = results
        self.calls = []
        self.active_calls = 0
        self.max_active_calls = 0

    async def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        self.active_calls += 1
        self.max_active_calls = max(self.max_active_calls, self.active_calls)
        await asyncio.sleep(0)
        self.active_calls -= 1
        return self.results[kwargs["query"]]


class FakeGenerator:
    def __init__(self):
        self.response_calls = []
        self.stream_calls = []

    async def generate_response(self, **kwargs):
        self.response_calls.append(kwargs)
        return "generated answer"

    async def generate_stream(self, **kwargs):
        self.stream_calls.append(kwargs)
        yield "generated "
        yield "answer"


@pytest.mark.asyncio
async def test_simple_plan_retrieves_once():
    original = "RAG là gì?"
    retriever = FakeRetriever({original: [context("A", 0.8)]})
    generator = FakeGenerator()
    pipeline = RAGPipeline(
        custom_retriever=retriever,
        custom_generator=generator,
        custom_query_planner=FakePlanner(QueryPlan(type="simple", queries=[original])),
    )

    result = await pipeline.answer_question(original, filter_dict={"space_id": "space-1"})

    assert len(retriever.calls) == 1
    assert retriever.calls[0]["query"] == original
    assert retriever.calls[0]["top_k"] == 5
    assert result["sources"] == [context("A", 0.8)]
    assert generator.response_calls[0]["query"] == original


@pytest.mark.asyncio
async def test_multi_query_retrieval_merges_deduplicates_and_sorts():
    original = "RAG là gì và Fine-tuning là gì?"
    queries = ["RAG là gì?", "Fine-tuning là gì?"]
    retriever = FakeRetriever({
        queries[0]: [context("A", 0.91), context("B", 0.70, "lower B")],
        queries[1]: [context("B", 0.88, "higher B"), context("C", 0.80)],
    })
    generator = FakeGenerator()
    filter_dict = {"space_id": "space-42"}
    pipeline = RAGPipeline(
        custom_retriever=retriever,
        custom_generator=generator,
        custom_query_planner=FakePlanner(QueryPlan(type="multi_part", queries=queries)),
    )

    result = await pipeline.answer_question(
        original,
        top_k=5,
        score_threshold=0.25,
        filter_dict=filter_dict,
    )

    assert [item["chunk_id"] for item in result["sources"]] == ["A", "B", "C"]
    assert result["sources"][1]["text"] == "higher B"
    assert [item["score"] for item in result["sources"]] == [0.91, 0.88, 0.80]
    assert len(retriever.calls) == 2
    assert retriever.max_active_calls == 2
    assert all(call["top_k"] == 3 for call in retriever.calls)
    assert all(call["score_threshold"] == 0.25 for call in retriever.calls)
    assert all(call["filter_dict"] == filter_dict for call in retriever.calls)
    assert generator.response_calls[0]["query"] == original
    assert generator.response_calls[0]["contexts"] == result["sources"]


@pytest.mark.asyncio
async def test_comparison_plan_runs_each_retrieval_query():
    original = "RAG khác Fine-tuning như thế nào?"
    queries = ["RAG là gì?", "Fine-tuning là gì?"]
    retriever = FakeRetriever({queries[0]: [context("A", 0.9)], queries[1]: [context("B", 0.8)]})
    pipeline = RAGPipeline(
        custom_retriever=retriever,
        custom_generator=FakeGenerator(),
        custom_query_planner=FakePlanner(QueryPlan(type="comparison", queries=queries)),
    )

    await pipeline.answer_question(original, filter_dict={"space_id": "space-1"})

    assert [call["query"] for call in retriever.calls] == queries


@pytest.mark.asyncio
async def test_streaming_uses_same_multi_query_retrieval_and_space_filter():
    original = "Embedding và cosine similarity là gì?"
    queries = ["Embedding là gì?", "Cosine similarity là gì?"]
    filter_dict = {"space_id": "space-stream"}
    retriever = FakeRetriever({queries[0]: [context("A", 0.9)], queries[1]: [context("B", 0.8)]})
    generator = FakeGenerator()
    pipeline = RAGPipeline(
        custom_retriever=retriever,
        custom_generator=generator,
        custom_query_planner=FakePlanner(QueryPlan(type="multi_part", queries=queries)),
    )

    chunks = [chunk async for chunk in pipeline.answer_question_stream(
        original,
        filter_dict=filter_dict,
    )]

    assert chunks == ["generated ", "answer"]
    assert len(retriever.calls) == 2
    assert all(call["filter_dict"] == filter_dict for call in retriever.calls)
    assert generator.stream_calls[0]["query"] == original
    assert [item["chunk_id"] for item in generator.stream_calls[0]["contexts"]] == ["A", "B"]
