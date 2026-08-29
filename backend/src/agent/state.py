from dataclasses import dataclass, field
from collections.abc import Callable
from typing import Any, Dict, List, Literal, Optional

AgentRoute = Literal["general_chat", "rag", "summarize", "web_research", "research", "tutor"]


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
    history: List[Dict[str, str]] = field(default_factory=list)
    fixed_context: Optional[str] = None
    memory_context: Optional[str] = None
    progress_events: List[Dict[str, Any]] = field(default_factory=list)
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = field(
        default=None,
        repr=False,
    )
    db_session: Any = None
    tutor_pending: bool = False
    current_concept_id: Optional[str] = None
    tutor_action: Optional[str] = None
    tutor_reason: Optional[str] = None
