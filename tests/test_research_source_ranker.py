from src.agent.research.nodes.source_ranker import SourceRanker, authority_score


def test_source_ranker_prefers_authority_and_keeps_query_diversity():
    candidates = [
        {
            "title": "Official evidence",
            "url": "https://example.gov/research",
            "snippet": "transformer evidence architecture",
            "search_query": "transformer evidence",
            "research_questions": ["What evidence exists?"],
        },
        {
            "title": "Another result",
            "url": "https://blog.example.com/post",
            "snippet": "transformer evidence",
            "search_query": "transformer evidence",
            "research_questions": ["What evidence exists?"],
        },
        {
            "title": "Limitations",
            "url": "https://university.edu/limitations",
            "snippet": "attention limitations memory",
            "search_query": "attention limitations",
            "research_questions": ["What are the limitations?"],
        },
    ]

    ranked = SourceRanker().rank_candidates(candidates, limit=2)

    assert {item["search_query"] for item in ranked} == {
        "transformer evidence",
        "attention limitations",
    }
    assert authority_score("https://example.gov/report") > authority_score("https://blog.example.com")


def test_source_ranker_removes_near_duplicate_fetched_pages():
    text = "Independent evidence about retrieval systems " * 30
    sources = [
        {"title": "Original", "url": "https://example.edu/a", "text": text, "search_query": "retrieval evidence", "research_questions": []},
        {"title": "Mirror", "url": "https://mirror.example/b", "text": text, "search_query": "retrieval evidence", "research_questions": []},
    ]

    assert len(SourceRanker().rank_sources(sources)) == 1
