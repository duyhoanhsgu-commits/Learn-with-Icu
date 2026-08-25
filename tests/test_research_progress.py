from src.agent.research.state import ResearchState


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
