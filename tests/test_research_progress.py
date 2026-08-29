import pytest
from pydantic import ValidationError

from src.agent.nodes import research as research_module
from src.agent.nodes.research import research_node
from src.agent.research.state import ResearchState
from src.agent.state import AgentState
from src.api.routes.chat import safe_research_progress
from src.api.schemas import ChatQueryRequest, GeneralChatRequest


def test_research_progress_is_stored_and_forwarded():
    forwarded = []
    state = ResearchState(query="topic", progress_callback=forwarded.append)

    state.progress("research.search", "Searching", current=1, total=3)

    assert state.progress_events == [{
        "type": "research.search",
        "message": "Searching",
        "current": 1,
        "total": 3,
    }]
    assert forwarded == state.progress_events


def test_public_progress_drops_private_research_payloads():
    progress = safe_research_progress({
        "type": "research.done",
        "message": "Research report complete",
        "current": 4,
        "total": 4,
        "answer": "private generated answer",
        "sources": [{"text": "raw source content"}],
        "prompt": "hidden prompt",
    })

    assert progress == {
        "stage": "research.done",
        "message": "Research report complete",
        "current": 4,
        "total": 4,
    }


@pytest.mark.asyncio
async def test_agent_research_node_forwards_live_progress(monkeypatch):
    class FakeResearchGraph:
        async def run(self, state):
            state.progress("research.plan", "Planning research questions")
            state.report = "Report"
            return state

    forwarded = []
    monkeypatch.setattr(research_module, "research_graph", FakeResearchGraph())
    result = await research_node(AgentState(
        query="Research RAG",
        session_id="session-1",
        progress_callback=forwarded.append,
    ))

    assert result.answer == "Report"
    assert forwarded == [{
        "type": "research.plan",
        "message": "Planning research questions",
    }]


def test_chat_query_mode_defaults_to_auto_and_validates_research():
    assert GeneralChatRequest(question="Question").mode == "auto"
    assert GeneralChatRequest(question="Question", mode="research").mode == "research"
    assert ChatQueryRequest(question="Question", space_id="space-1").mode == "auto"
    assert ChatQueryRequest(
        question="Question",
        space_id="space-1",
        mode="research",
    ).mode == "research"

    with pytest.raises(ValidationError):
        ChatQueryRequest(question="Question", space_id="space-1", mode="invalid")
