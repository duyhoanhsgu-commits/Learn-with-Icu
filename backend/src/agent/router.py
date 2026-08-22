import re

from src.agent.state import AgentRoute, AgentState

_SUMMARY_PATTERNS = (
    r"\bsummar(?:y|ize|ise|ization)\b",
    r"\btldr\b",
    r"\bkey (?:points|ideas|takeaways)\b",
    r"\btóm tắt\b",
    r"\bý chính\b",
    r"\bđiểm chính\b",
)


def route_agent(state: AgentState) -> AgentRoute:
    """Choose one node deterministically from endpoint intent and query text."""
    if state.requested_route:
        return state.requested_route
    if not state.space_id:
        return "general_chat"
    query = state.query.casefold()
    if any(re.search(pattern, query) for pattern in _SUMMARY_PATTERNS):
        return "summarize"
    return "rag"
