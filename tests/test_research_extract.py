import json
from types import SimpleNamespace

import pytest

from src.agent.research.nodes.extract import EvidenceExtractor, rank_relevant_chunks
from src.agent.research.state import ResearchState


class FakeCompletions:
    def __init__(self, payload):
        self.payload = payload

    async def create(self, **kwargs):
        message = SimpleNamespace(content=json.dumps(self.payload))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(payload):
    return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(payload)))


def test_chunk_ranking_prefers_question_terms():
    chunks = [
        "Gardening requires water and healthy soil.",
        "GraphRAG constructs an entity graph before retrieval.",
        "Cooking times vary by ingredient.",
    ]

    ranked = rank_relevant_chunks(chunks, "How does GraphRAG entity retrieval work?", limit=1)

    assert ranked == [chunks[1]]


@pytest.mark.asyncio
async def test_extract_keeps_grounded_quote_and_metadata():
    quote = "GraphRAG constructs an entity graph before retrieval."
    payload = {"evidence": [{
        "claim": "GraphRAG uses an entity graph.",
        "evidence": quote,
        "research_question": "How does GraphRAG work?",
    }]}
    extractor = EvidenceExtractor(client=fake_client(payload))
    state = ResearchState(query="GraphRAG")
    state.web_sources = [{
        "title": "Research article",
        "url": "https://example.com/article",
        "text": f"Introduction. {quote} Conclusion.",
        "research_questions": ["How does GraphRAG work?"],
        "source_type": "web",
        "extracted": False,
    }]

    await extractor.run(state)

    assert len(state.evidence) == 1
    assert state.evidence[0]["evidence"] == quote
    assert state.evidence[0]["url"] == "https://example.com/article"
    assert state.evidence[0]["source_type"] == "web"


@pytest.mark.asyncio
async def test_extract_discards_hallucinated_quote():
    payload = {"evidence": [{
        "claim": "Unsupported claim",
        "evidence": "This sentence is absent from the page.",
        "research_question": "What is supported?",
    }]}
    extractor = EvidenceExtractor(client=fake_client(payload))
    source = {
        "title": "Page",
        "url": "https://example.com",
        "text": "Only grounded source content appears here.",
        "research_questions": ["What is supported?"],
        "source_type": "web",
    }

    assert await extractor.extract_source(source) == []


@pytest.mark.asyncio
async def test_extract_does_not_treat_internal_question_label_as_source_text():
    payload = {"evidence": [{
        "claim": "The label is evidence.",
        "evidence": "For: What is supported?",
        "research_question": "What is supported?",
    }]}
    extractor = EvidenceExtractor(client=fake_client(payload))
    source = {
        "title": "Page",
        "url": "https://example.com",
        "text": "Only actual page content is valid evidence.",
        "research_questions": ["What is supported?"],
        "source_type": "web",
    }

    assert await extractor.extract_source(source) == []
