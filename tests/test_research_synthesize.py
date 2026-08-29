from types import SimpleNamespace

import pytest

from src.agent.research.nodes.synthesize import ResearchSynthesizer, build_source_catalog
from src.agent.research.models import QueryUnderstanding
from src.agent.research.state import ResearchState


def evidence(source_type, source, excerpt, **metadata):
    return {
        "claim": excerpt,
        "evidence": excerpt,
        "source": source,
        "research_question": "How does it work?",
        "source_type": source_type,
        **metadata,
    }


class FakeCompletions:
    def __init__(self, content):
        self.content = content
        self.last_kwargs = None

    async def create(self, **kwargs):
        self.last_kwargs = kwargs
        message = SimpleNamespace(content=self.content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(content):
    return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(content)))


def test_source_catalog_deduplicates_web_url_and_preserves_local_metadata():
    items = [
        evidence("web", "Article", "first", url="https://example.com"),
        evidence("web", "Article", "second", url="https://example.com"),
        evidence(
            "local",
            "book.pdf",
            "local excerpt",
            chunk_id="chunk-1",
            document_id="document-1",
            chunk_index=4,
            score=0.9,
        ),
    ]

    sources, numbered = build_source_catalog(items)

    assert len(sources) == 2
    assert [item["source_number"] for item in numbered] == [1, 1, 2]
    assert sources[1]["document_id"] == "document-1"
    assert sources[1]["chunk_index"] == 4


@pytest.mark.asyncio
async def test_synthesis_fallback_has_required_sections_and_real_sources():
    state = ResearchState(
        query="Compare RAG and GraphRAG",
        missing_topics=["deployment benchmarks"],
        evidence=[
            evidence("web", "Microsoft Research", "GraphRAG builds a graph.", url="https://example.com/graphrag"),
            evidence(
                "local",
                "notes.pdf",
                "RAG retrieves document chunks.",
                chunk_id="chunk-2",
                document_id="doc-1",
                chunk_index=2,
            ),
        ],
    )

    report, sources = await ResearchSynthesizer(client=False).synthesize(state)

    for heading in (
        "# Summary",
        "# Key Findings",
        "# Detailed Analysis",
        "# Comparison",
        "# Limitations / Uncertainty",
        "# Sources",
    ):
        assert heading in report
    assert "[1] Microsoft Research — https://example.com/graphrag" in report
    assert "[2] notes.pdf — chunk 3" in report
    assert "## How does it work?" in report
    assert len(sources) == 2


@pytest.mark.asyncio
async def test_synthesis_without_citations_uses_grounded_fallback():
    state = ResearchState(
        query="Research topic",
        evidence=[evidence(
            "web",
            "Article",
            "A grounded finding.",
            url="https://example.com/article",
        )],
    )
    synthesizer = ResearchSynthesizer(client=fake_client("A report with no citation."))

    report, sources = await synthesizer.synthesize(state)

    assert "A grounded finding. [1]" in report
    assert sources[0]["url"] == "https://example.com/article"


@pytest.mark.asyncio
async def test_research_synthesis_uses_larger_bounded_output_budget():
    client = fake_client("Grounded answer. [1]")
    state = ResearchState(
        query="Research topic",
        evidence=[evidence(
            "web",
            "Article",
            "Grounded evidence.",
            url="https://example.com/article",
        )],
    )

    await ResearchSynthesizer(client=client).synthesize(state)

    assert client.chat.completions.last_kwargs["max_completion_tokens"] == 12_000


@pytest.mark.asyncio
async def test_research_synthesis_can_use_a_dedicated_stronger_model():
    client = fake_client("Grounded answer. [1]")
    state = ResearchState(
        query="Research topic",
        evidence=[evidence(
            "web",
            "Article",
            "Grounded evidence.",
            url="https://example.com/article",
        )],
    )

    await ResearchSynthesizer(
        client=client,
        model_name="research-synthesis-model",
    ).synthesize(state)

    assert (
        client.chat.completions.last_kwargs["model"]
        == "research-synthesis-model"
    )


@pytest.mark.asyncio
async def test_deep_synthesis_prompt_requires_question_by_question_detail():
    client = fake_client("Grounded detailed answer. [1]")
    state = ResearchState(
        query="Compare retrieval approaches",
        query_understanding=QueryUnderstanding(
            topic="Retrieval approaches",
            depth="deep",
            constraints=["Focus on production trade-offs"],
        ),
        research_questions=[
            "How does each approach work?",
            "What production trade-offs apply?",
        ],
        evidence=[evidence(
            "web",
            "Article",
            "Grounded evidence.",
            url="https://example.com/article",
        )],
    )

    await ResearchSynthesizer(client=client).synthesize(state)

    prompt = client.chat.completions.last_kwargs["messages"][-1]["content"]
    assert "Research depth: deep" in prompt
    assert "1,800–3,000 words" in prompt
    assert "How does each approach work?" in prompt
    assert "Focus on production trade-offs" in prompt
