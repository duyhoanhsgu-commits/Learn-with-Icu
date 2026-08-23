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

_WEB_PATTERNS = (
    r"\bsearch (?:the )?web\b",
    r"\bsearch online\b",
    r"\blook (?:it )?up\b",
    r"\blatest\b",
    r"\bcurrent(?:ly)?\b",
    r"\btìm (?:trên )?(?:web|mạng|internet)\b",
    r"\btra cứu\b",
    r"\bmới nhất\b",
)


def route_agent(state: AgentState) -> AgentRoute:
    """Choose one node deterministically from endpoint intent and query text."""
    if state.requested_route:
        return state.requested_route
    query = state.query.casefold()
    if any(re.search(pattern, query) for pattern in _WEB_PATTERNS):
        return "web_research"
    if not state.space_id:
        return "general_chat"
    if any(re.search(pattern, query) for pattern in _SUMMARY_PATTERNS):
        return "summarize"
    return "rag"
