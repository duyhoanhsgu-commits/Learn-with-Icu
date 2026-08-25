import pytest

from src.agent.research.nodes.search import (
    FOLLOW_UP_SOURCE_RESERVE,
    MAX_SEARCH_RESULTS_PER_QUERY,
    MAX_TOTAL_SOURCES,
    ResearchSearcher,
    canonical_url,
)
from src.agent.research.state import ResearchState


def test_canonical_url_removes_fragments_tracking_and_default_port():
    first = canonical_url("https://Example.com:443/article/?utm_source=test&id=2#part")
    second = canonical_url("https://example.com/article?id=2")

    assert first == second


@pytest.mark.asyncio
async def test_search_deduplicates_urls_and_tolerates_fetch_failure():
    def search(query, max_results):
        assert max_results == MAX_SEARCH_RESULTS_PER_QUERY
        return [
            {"title": "Shared", "url": "https://example.com/shared?utm_source=x", "snippet": "a"},
            {"title": query, "url": f"https://example.com/{query[-1]}", "snippet": "b"},
        ]

    def fetch(url):
        if url.endswith("/2"):
            raise ValueError("unreadable")
        return {"title": "Fetched", "url": url, "text": "Useful source text"}

    state = ResearchState(
        query="topic",
        research_questions=["question 1", "question 2"],
        search_queries=["query 1", "query 2"],
        query_question_map={"query 1": "question 1", "query 2": "question 2"},
    )

    await ResearchSearcher(search_fn=search, fetch_fn=fetch).run(state)

    assert state.iteration == 1
    assert len(state.web_sources) == 2
    shared = next(source for source in state.web_sources if "shared" in source["url"])
    assert shared["research_questions"] == ["question 1", "question 2"]
    assert all(source["text"] == "Useful source text" for source in state.web_sources)


@pytest.mark.asyncio
async def test_search_caps_total_sources():
    def search(query, max_results):
        return [
            {"title": str(index), "url": f"https://example.com/{query}/{index}", "snippet": ""}
            for index in range(max_results)
        ]

    def fetch(url):
        return {"title": url, "url": url, "text": "text"}

    queries = ["one", "two", "three"]
    state = ResearchState(
        query="topic",
        search_queries=queries,
        query_question_map={query: query for query in queries},
    )

    await ResearchSearcher(search_fn=search, fetch_fn=fetch).run(state)

    assert len(state.web_sources) == MAX_TOTAL_SOURCES - FOLLOW_UP_SOURCE_RESERVE
    assert {source["search_query"] for source in state.web_sources} == set(queries)

    state.search_queries = ["follow up"]
    state.query_question_map["follow up"] = "missing topic"
    await ResearchSearcher(search_fn=search, fetch_fn=fetch).run(state)

    assert len(state.web_sources) == MAX_TOTAL_SOURCES
