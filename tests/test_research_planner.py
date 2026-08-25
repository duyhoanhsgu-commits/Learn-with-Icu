import json
from types import SimpleNamespace

import pytest

from src.agent.research.nodes.planner import ResearchPlanner
from src.agent.research.state import ResearchState


class FakeCompletions:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    async def create(self, **kwargs):
        if self.error:
            raise self.error
        message = SimpleNamespace(content=json.dumps(self.payload))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(payload=None, error=None):
    return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(payload, error)))


@pytest.mark.asyncio
async def test_research_planner_returns_structured_questions_and_queries():
    payload = {
        "research_questions": [
            "How does RAG work?",
            "How does GraphRAG work?",
            "When should each be used?",
            "What are their cost differences?",
        ],
        "search_queries": [
            "RAG architecture retrieval augmented generation",
            "GraphRAG architecture entity graph retrieval",
            "RAG GraphRAG production use cases",
            "RAG GraphRAG infrastructure cost",
        ],
    }
    planner = ResearchPlanner(client=fake_client(payload))

    plan = await planner.plan("Compare RAG and GraphRAG")

    assert plan.research_questions == payload["research_questions"]
    assert plan.search_queries == payload["search_queries"]
    assert 3 <= len(plan.research_questions) <= 6


@pytest.mark.asyncio
async def test_research_planner_failure_uses_bounded_fallback():
    planner = ResearchPlanner(client=fake_client(error=RuntimeError("bad LLM")))

    plan = await planner.plan("Research retrieval systems")

    assert len(plan.research_questions) == 3
    assert len(plan.search_queries) == 3
    assert plan.research_questions[0] == "Research retrieval systems"


@pytest.mark.asyncio
async def test_research_planner_rejects_duplicates_that_break_minimum():
    duplicate_payload = {
        "research_questions": ["same", "same", "same"],
        "search_queries": ["same", "same", "same"],
    }
    planner = ResearchPlanner(client=fake_client(duplicate_payload))

    plan = await planner.plan("Original research request")

    assert len(plan.research_questions) == 3
    assert plan.research_questions[0] == "Original research request"


def test_research_state_starts_with_bounded_loop_defaults():
    state = ResearchState(query="topic", space_id="space-1")

    assert state.iteration == 0
    assert state.enough_evidence is False
    assert state.space_id == "space-1"
