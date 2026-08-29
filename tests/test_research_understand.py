import json
from types import SimpleNamespace

import pytest

from src.agent.research.nodes.understand import QueryUnderstandingNode
from src.agent.research.state import ResearchState


class FakeCompletions:
    async def create(self, **kwargs):
        payload = {
            "topic": "Transformer efficiency",
            "intent": "deep_research",
            "depth": "standard",
            "entities": ["Transformer"],
            "constraints": ["peer-reviewed evidence"],
            "needs_fresh_information": True,
            "use_local_sources": True,
            "use_web_sources": True,
        }
        return SimpleNamespace(choices=[SimpleNamespace(
            message=SimpleNamespace(content=json.dumps(payload)),
        )])


@pytest.mark.asyncio
async def test_query_understanding_uses_structured_llm_output():
    client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    state = ResearchState(query="Research current Transformer efficiency", space_id="space-1")

    await QueryUnderstandingNode(client=client).run(state)

    assert state.query_understanding.topic == "Transformer efficiency"
    assert state.query_understanding.needs_fresh_information is True
    assert state.query_understanding.use_local_sources is True
    assert state.query_understanding.depth == "deep"


@pytest.mark.asyncio
async def test_query_understanding_respects_explicit_brief_request():
    client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    state = ResearchState(query="Give me a brief research report about RAG")

    await QueryUnderstandingNode(client=client).run(state)

    assert state.query_understanding.depth == "brief"


def test_query_understanding_fallback_disables_local_without_space():
    result = QueryUnderstandingNode.fallback("latest RAG research", has_space=False)

    assert result.needs_fresh_information is True
    assert result.use_local_sources is False
    assert result.use_web_sources is True
