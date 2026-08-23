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
