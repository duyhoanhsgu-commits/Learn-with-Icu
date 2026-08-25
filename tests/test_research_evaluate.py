import json
from types import SimpleNamespace

import pytest

from src.agent.research.graph import MAX_RESEARCH_ITERATIONS, ResearchGraph
from src.agent.research.nodes.evaluate import ResearchEvaluator
from src.agent.research.nodes.planner import ResearchPlan
from src.agent.research.state import ResearchState


class FakeCompletions:
    def __init__(self, payload):
        self.payload = payload

    async def create(self, **kwargs):
        message = SimpleNamespace(content=json.dumps(self.payload))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(payload):
    return SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions(payload)))


@pytest.mark.asyncio
async def test_evaluator_returns_structured_missing_topics():
    evaluator = ResearchEvaluator(client=fake_client({
        "enough": False,
        "missing_topics": ["deployment cost", "production benchmarks"],
    }))
    state = ResearchState(query="Compare systems", research_questions=["cost", "benchmarks"])

    await evaluator.run(state)

    assert state.enough_evidence is False
    assert state.missing_topics == ["deployment cost", "production benchmarks"]
    assert evaluator.follow_up_queries(state) == [
        "deployment cost Compare systems",
        "production benchmarks Compare systems",
    ]


def test_evaluator_fallback_routes_to_missing_question():
    state = ResearchState(
        query="topic",
        research_questions=["covered", "missing"],
        evidence=[{"research_question": "covered", "evidence": "proof"}],
    )

    result = ResearchEvaluator.fallback(state)

    assert result.enough is False
    assert result.missing_topics == ["missing"]


class FixedPlanner:
    async def plan(self, query, **kwargs):
        return ResearchPlan(
            research_questions=["one", "two", "three"],
            search_queries=["q1", "q2", "q3"],
        )


class CountingSearcher:
    async def run(self, state):
        state.iteration += 1
        state.searched_queries.extend(state.search_queries)
        return state


class NoopExtractor:
    async def run(self, state):
        return state


class AlwaysMissingEvaluator:
    async def run(self, state):
        state.enough_evidence = False
        state.missing_topics = [f"missing iteration {state.iteration}"]
        return state

    def follow_up_query_map(self, state):
        return {f"followup {state.iteration}": state.missing_topics[0]}


class NoopSynthesizer:
    async def run(self, state):
        state.report = "report"
        return state


@pytest.mark.asyncio
async def test_research_graph_never_exceeds_max_iterations():
    graph = ResearchGraph(
        planner=FixedPlanner(),
        searcher=CountingSearcher(),
        extractor=NoopExtractor(),
        evaluator=AlwaysMissingEvaluator(),
        synthesizer=NoopSynthesizer(),
    )

    state = await graph.run(ResearchState(query="complex research"))

    assert state.iteration == MAX_RESEARCH_ITERATIONS
    assert state.enough_evidence is False


def test_follow_up_query_map_preserves_topic_after_deduplication():
    state = ResearchState(
        query="Compare systems",
        missing_topics=["already searched", "new evidence"],
        searched_queries=["already searched Compare systems"],
    )

    result = ResearchEvaluator.follow_up_query_map(state)

    assert result == {"new evidence Compare systems": "new evidence"}
