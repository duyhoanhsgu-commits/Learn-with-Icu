from src.api.routes.spaces import router as spaces_router
from src.api.schemas import (
    KnowledgeGraphResponse,
    LearnerStateResponse,
    LearningPathResponse,
)
from src.storage.postgres import Base


def test_tutor_storage_tables_are_registered():
    assert {"concepts", "concept_edges", "concept_sources", "learner_concepts"}.issubset(
        Base.metadata.tables
    )


def test_future_frontend_api_contracts_are_registered():
    paths = {route.path for route in spaces_router.routes if hasattr(route, "path")}

    assert "/spaces/{space_id}/knowledge-graph" in paths
    assert "/spaces/{space_id}/learner-state" in paths
    assert "/spaces/{space_id}/learning-path" in paths


def test_empty_tutor_contracts_are_frontend_friendly():
    graph = KnowledgeGraphResponse(space_id="s", learner_id="u", nodes=[], edges=[])
    state = LearnerStateResponse(space_id="s", learner_id="u", concepts=[])
    path = LearningPathResponse(
        space_id="s",
        learner_id="u",
        mastered=[],
        learning=[],
        recommended_next=[],
        review=[],
        diagnostic_candidates=[],
    )

    assert graph.nodes == []
    assert state.concepts == []
    assert path.recommended_next == []
