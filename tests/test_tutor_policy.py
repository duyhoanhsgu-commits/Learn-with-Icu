from src.knowledge.graph import KnowledgeGraph
from src.tutor.planner import TutorPlanner
from src.tutor.policy import TutorAction, TutorPolicy


def graph():
    return KnowledgeGraph(
        [
            {"id": "vector", "space_id": "s", "name": "Vector", "difficulty": 1},
            {"id": "embedding", "space_id": "s", "name": "Embedding", "difficulty": 2},
            {"id": "search", "space_id": "s", "name": "Semantic Search", "difficulty": 3},
        ],
        [
            {"space_id": "s", "source": "vector", "target": "embedding", "relation": "prerequisite_of"},
            {"space_id": "s", "source": "embedding", "target": "search", "relation": "prerequisite_of"},
        ],
        "s",
    )


def test_tutor_action_selection_uses_mastery_thresholds():
    policy = TutorPolicy()
    concept = graph().concepts["embedding"]

    assert policy.action_for(concept, 0.0, has_evidence=False) == TutorAction.TEACH_NEW
    assert policy.action_for(concept, 0.5, has_evidence=True) == TutorAction.REVIEW
    assert policy.action_for(concept, 0.75, has_evidence=True) == TutorAction.ASSESS
    assert policy.action_for(concept, 0.9, has_evidence=True) == TutorAction.ANSWER


def test_next_concept_requires_mastered_prerequisites():
    policy = TutorPolicy()
    knowledge = graph()

    assert policy.select_next_concept(knowledge, {}).id == "vector"
    assert policy.select_next_concept(knowledge, {"vector": 0.72}).id == "embedding"
    assert policy.select_next_concept(knowledge, {"vector": 0.5}).id == "vector"


def test_planner_identifies_relevant_concept_and_diagnostic_foundation():
    planner = TutorPlanner()
    knowledge = graph()
    plan = planner.plan(
        message="Teach me Embedding",
        graph=knowledge,
        mastery_by_concept={"vector": 0.8, "embedding": 0.2},
        evidence_concepts=set(),
    )
    diagnostic = planner.plan(
        message="Start diagnostic",
        graph=knowledge,
        mastery_by_concept={},
        diagnostic=True,
    )

    assert plan.concept_id == "embedding"
    assert plan.action == TutorAction.TEACH_NEW
    assert diagnostic.concept_id == "vector"
    assert diagnostic.action == TutorAction.ASSESS


def test_explicit_learner_intent_overrides_mastery_policy():
    planner = TutorPlanner()
    knowledge = graph()
    struggling = planner.plan(
        message="Tôi chưa hiểu Embedding",
        graph=knowledge,
        mastery_by_concept={"embedding": 0.0},
    )
    assessment = planner.plan(
        message="Kiểm tra tôi về Embedding",
        graph=knowledge,
        mastery_by_concept={"embedding": 0.0},
    )

    assert struggling.action == TutorAction.REVIEW
    assert assessment.action == TutorAction.ASSESS
