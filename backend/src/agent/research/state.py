from dataclasses import dataclass, field
from collections.abc import Callable
from typing import Any, Optional


@dataclass
class ResearchState:
    """Mutable state passed through the single-agent research graph."""

    query: str
    space_id: Optional[str] = None
    research_questions: list[str] = field(default_factory=list)
    search_queries: list[str] = field(default_factory=list)
    searched_queries: list[str] = field(default_factory=list)
    query_question_map: dict[str, str] = field(default_factory=dict)
    web_sources: list[dict[str, Any]] = field(default_factory=list)
    local_sources: list[dict[str, Any]] = field(default_factory=list)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    iteration: int = 0
    enough_evidence: bool = False
    missing_topics: list[str] = field(default_factory=list)
    report: Optional[str] = None
    sources: list[dict[str, Any]] = field(default_factory=list)
    progress_events: list[dict[str, Any]] = field(default_factory=list)
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = field(
        default=None,
        repr=False,
    )

    def progress(self, event_type: str, message: str, **data: Any) -> None:
        event = {"type": event_type, "message": message, **data}
        self.progress_events.append(event)
        if self.progress_callback:
            self.progress_callback(event)
