import json
from types import SimpleNamespace

import pytest

from src.rag.query_planner import MAX_SUB_QUERIES, QueryPlanner


class FakeCompletions:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    async def create(self, **_kwargs):
        if self.error:
            raise self.error
        message = SimpleNamespace(content=json.dumps(self.payload))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(payload=None, error=None):
    completions = FakeCompletions(payload=payload, error=error)
    return SimpleNamespace(chat=SimpleNamespace(completions=completions))


@pytest.mark.asyncio
async def test_simple_question_preserves_original_query():
    planner = QueryPlanner(client=fake_client({"type": "simple", "queries": ["rewritten"]}))

    plan = await planner.plan("RAG là gì?")

    assert plan.type == "simple"
    assert plan.queries == ["RAG là gì?"]


@pytest.mark.asyncio
async def test_multi_part_question_returns_multiple_queries():
    planner = QueryPlanner(client=fake_client({
        "type": "multi_part",
        "queries": ["RAG là gì?", "Fine-tuning là gì?"],
    }))

    plan = await planner.plan("RAG là gì và Fine-tuning là gì?")

    assert plan.type == "multi_part"
    assert plan.queries == ["RAG là gì?", "Fine-tuning là gì?"]


@pytest.mark.asyncio
async def test_comparison_question_returns_comparison_plan():
    planner = QueryPlanner(client=fake_client({
        "type": "comparison",
        "queries": ["RAG là gì?", "Fine-tuning là gì?"],
    }))

    plan = await planner.plan("RAG khác Fine-tuning như thế nào?")

    assert plan.type == "comparison"
    assert len(plan.queries) == 2


@pytest.mark.asyncio
async def test_planner_limits_sub_queries():
    queries = [f"query {index}" for index in range(MAX_SUB_QUERIES + 2)]
    planner = QueryPlanner(client=fake_client({"type": "multi_part", "queries": queries}))

    plan = await planner.plan("A complex question")

    assert len(plan.queries) == MAX_SUB_QUERIES


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "client",
    [
        fake_client(error=RuntimeError("LLM unavailable")),
        fake_client({"type": "comparison", "queries": ["only one query"]}),
        fake_client({"unexpected": "shape"}),
    ],
)
async def test_planner_failure_falls_back_to_original_query(client):
    planner = QueryPlanner(client=client)

    plan = await planner.plan("Original question")

    assert plan.type == "simple"
    assert plan.queries == ["Original question"]
