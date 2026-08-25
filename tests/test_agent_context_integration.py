from types import SimpleNamespace

import pytest

import src.api.routes.chat as chat_routes
from src.agent.nodes.rag import rag_node
from src.agent.nodes.research import research_node
from src.agent.research.nodes.synthesize import ResearchSynthesizer
from src.agent.research.state import ResearchState
from src.agent.state import AgentState
from src.api.schemas import ChatQueryRequest
from src.rag.generator import RAGGenerator
from src.storage.postgres import ChatConversation, LearningSpace


class CapturingCompletions:
    def __init__(self, content="Answer [1]"):
        self.content = content
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self.content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def capturing_client(content="Answer [1]"):
    completions = CapturingCompletions(content)
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    return client, completions


class FakeChatSession:
    def __init__(self, space):
        self.space = space
        self.added = []
        self.commits = 0

    async def get(self, model, identifier):
        if model is LearningSpace:
            return self.space if self.space.id == identifier else None
        if model is ChatConversation:
            return None
        raise AssertionError(f"Unexpected model: {model}")

    async def execute(self, statement):
        class EmptyScalars:
            @staticmethod
            def all():
                return []

        return SimpleNamespace(scalars=lambda: EmptyScalars())

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1


class CapturingAgentGraph:
    def __init__(self):
        self.state = None

    async def run(self, state):
        self.state = state
        state.answer = "Context-aware answer"
        state.sources = []
        return state


@pytest.mark.asyncio
async def test_chat_query_loads_fixed_context_into_agent_state(monkeypatch):
    graph = CapturingAgentGraph()
    monkeypatch.setattr(chat_routes, "agent_graph", graph)
    session = FakeChatSession(LearningSpace(
        id="space-a",
        name="A",
        color="blue",
        fixed_context="Current goal: build a Research Agent",
    ))

    response = await chat_routes.chat_query(
        ChatQueryRequest(
            question="What should I do next?",
            session_id="new-conversation",
            space_id="space-a",
        ),
        session,
    )

    assert graph.state.fixed_context == "Current goal: build a Research Agent"
    assert graph.state.space_id == "space-a"
    assert response.answer == "Context-aware answer"


@pytest.mark.asyncio
async def test_rag_generator_receives_fixed_context_in_ordered_messages():
    client, completions = capturing_client()
    generator = RAGGenerator()
    generator._client = client

    await generator.generate_response(
        query="What should I learn next?",
        contexts=[{"source": "notes.pdf", "text": "RAG retrieval is working."}],
        fixed_context="Learning goal: become an AI Engineer",
        memory_context="[goal] current_topic: Advanced retrieval",
        history=[{"role": "assistant", "content": "We finished ingestion."}],
    )

    messages = completions.calls[0]["messages"]
    assert [message["role"] for message in messages] == [
        "system",
        "system",
        "system",
        "system",
        "assistant",
        "user",
    ]
    assert "Learning goal: become an AI Engineer" in messages[1]["content"]
    assert "Advanced retrieval" in messages[2]["content"]
    assert "RAG retrieval is working." in messages[3]["content"]


@pytest.mark.asyncio
async def test_rag_node_forwards_fixed_context_and_history(monkeypatch):
    captured = {}

    async def fake_answer_question(**kwargs):
        captured.update(kwargs)
        return {"answer": "answer", "sources": []}

    monkeypatch.setattr(
        "src.agent.nodes.rag.rag_pipeline.answer_question",
        fake_answer_question,
    )
    state = AgentState(
        query="Question",
        session_id="session",
        space_id="space-a",
        fixed_context="Fixed",
        history=[{"role": "user", "content": "Earlier"}],
    )

    await rag_node(state)

    assert captured["fixed_context"] == "Fixed"
    assert captured["history"] == state.history
    assert captured["filter_dict"] == {"space_id": "space-a"}


@pytest.mark.asyncio
async def test_research_node_forwards_fixed_context(monkeypatch):
    captured = {}

    async def fake_run(state):
        captured["state"] = state
        state.report = "report"
        return state

    monkeypatch.setattr("src.agent.nodes.research.research_graph.run", fake_run)
    agent_state = AgentState(
        query="Deep research RAG",
        session_id="session",
        space_id="space-a",
        fixed_context="Project: Learn-with-Icu",
        memory_context="[goal] focus: Research Agents",
        history=[{"role": "assistant", "content": "Previous progress"}],
    )

    await research_node(agent_state)

    research_state = captured["state"]
    assert research_state.fixed_context == "Project: Learn-with-Icu"
    assert research_state.memory_context == "[goal] focus: Research Agents"
    assert research_state.history == agent_state.history


@pytest.mark.asyncio
async def test_research_synthesis_receives_fixed_context():
    client, completions = capturing_client("# Summary\nGrounded [1]")
    state = ResearchState(
        query="Research RAG",
        fixed_context="Current stack: FastAPI and Qdrant",
        memory_context="[technical_decision] vector_db: Qdrant",
        evidence=[{
            "claim": "RAG retrieves evidence.",
            "evidence": "RAG retrieves evidence.",
            "source": "Article",
            "research_question": "How does RAG work?",
            "source_type": "web",
            "url": "https://example.com/rag",
        }],
    )

    await ResearchSynthesizer(client=client).synthesize(state)

    messages = completions.calls[0]["messages"]
    assert "Current stack: FastAPI and Qdrant" in messages[1]["content"]
    assert "vector_db: Qdrant" in messages[2]["content"]
    assert "RAG retrieves evidence." in messages[3]["content"]


@pytest.mark.asyncio
async def test_empty_fixed_context_keeps_rag_generation_working():
    client, completions = capturing_client()
    generator = RAGGenerator()
    generator._client = client

    answer = await generator.generate_response(
        query="Question",
        contexts=[],
        fixed_context="",
    )

    assert answer == "Answer [1]"
    assert [message["role"] for message in completions.calls[0]["messages"]] == [
        "system",
        "system",
        "user",
    ]
