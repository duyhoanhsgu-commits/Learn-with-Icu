from src.agent.router import route_agent
from src.agent.state import AgentState


def test_general_chat_route_without_space():
    assert route_agent(AgentState(query="Explain recursion", session_id="s1")) == "general_chat"


def test_rag_route_with_space():
    state = AgentState(query="What does the book say?", session_id="s1", space_id="space-1")
    assert route_agent(state) == "rag"


def test_summarize_route_in_english_and_vietnamese():
    english = AgentState(query="Summarize this book", session_id="s1", space_id="space-1")
    vietnamese = AgentState(query="Tóm tắt ý chính", session_id="s1", space_id="space-1")
    assert route_agent(english) == "summarize"
    assert route_agent(vietnamese) == "summarize"


def test_explicit_route_has_priority():
    state = AgentState(
        query="Summarize this",
        session_id="s1",
        space_id="space-1",
        requested_route="rag",
    )
    assert route_agent(state) == "rag"


def test_current_information_routes_to_web_research():
    state = AgentState(query="Tìm trên mạng tin AI mới nhất", session_id="s1")
    assert route_agent(state) == "web_research"


def test_explicit_deep_research_intent_routes_to_research():
    english = AgentState(
        query="Compare RAG and GraphRAG using multiple sources",
        session_id="s1",
    )
    vietnamese = AgentState(
        query="Tìm hiểu kỹ RAG và GraphRAG",
        session_id="s2",
        space_id="space-1",
    )

    assert route_agent(english) == "research"
    assert route_agent(vietnamese) == "research"


def test_simple_web_query_remains_backward_compatible():
    state = AgentState(query="Search the web for Python 3.14 news", session_id="s1")

    assert route_agent(state) == "web_research"


def test_tutor_route_is_opt_in_and_pending_assessment_resumes():
    request = AgentState(
        query="Teach me embeddings",
        session_id="s1",
        space_id="space-1",
    )
    pending = AgentState(
        query="An embedding is a dense vector",
        session_id="s1",
        space_id="space-1",
        tutor_pending=True,
    )

    assert route_agent(request) == "tutor"
    assert route_agent(pending) == "tutor"


def test_struggle_and_assessment_language_routes_to_tutor():
    messages = (
        "Tôi đang bí phần embedding",
        "Mình chưa hiểu semantic search",
        "I'm stuck on vectors",
        "Hỏi tôi vài câu về RAG",
    )

    for message in messages:
        state = AgentState(query=message, session_id="s1", space_id="space-1")
        assert route_agent(state) == "tutor"
