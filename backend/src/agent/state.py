from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

AgentRoute = Literal["general_chat", "rag", "summarize", "web_research"]


@dataclass
class AgentState:
    query: str
    session_id: str
    space_id: Optional[str] = None
    top_k: int = 5
    score_threshold: float = 0.0
    image_data_url: Optional[str] = None
    requested_route: Optional[AgentRoute] = None
    route: Optional[AgentRoute] = None
    answer: str = ""
    sources: List[Dict[str, Any]] = field(default_factory=list)
