import json
from types import SimpleNamespace

import pytest

from src.agent.research.models import ResearchQuestion
from src.agent.research.nodes.query_rewrite import QueryRewriter
from src.agent.research.state import ResearchState


class FakeCompletions:
    async def create(self, **kwargs):
        payload = {"rewrites": [
            {"research_question_id": "rq_1", "queries": ["attention complexity", "attention complexity"]},
            {"research_question_id": "rq_2", "queries": ["attention complexity"]},
        ]}
        return SimpleNamespace(choices=[SimpleNamespace(
            message=SimpleNamespace(content=json.dumps(payload)),
        )])


@pytest.mark.asyncio
async def test_query_rewrite_deduplicates_globally_and_preserves_mapping():
    state = ResearchState(query="Research attention")
    state.research_plan = [
        ResearchQuestion(
            id="rq_1",
            question="How expensive is attention?",
            type="mechanism",
            priority=1,
            search_query="attention computational complexity",
        ),
        ResearchQuestion(
            id="rq_2",
            question="What are attention limitations?",
            type="limitation",
            priority=2,
            search_query="attention architecture limitations",
        ),
    ]
    client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))

    await QueryRewriter(client=client).run(state)

    assert state.search_queries == ["attention complexity", "attention architecture limitations"]
    assert state.question_query_map == {
        "rq_1": ["attention complexity"],
        "rq_2": ["attention architecture limitations"],
    }
    assert state.query_question_map["attention complexity"] == "How expensive is attention?"
