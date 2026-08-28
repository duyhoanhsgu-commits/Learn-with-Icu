from enum import Enum
from typing import Mapping

from src.knowledge.graph import GraphConcept, KnowledgeGraph


class TutorAction(str, Enum):
    TEACH_NEW = "TEACH_NEW"
    REVIEW = "REVIEW"
    ASSESS = "ASSESS"
    ANSWER = "ANSWER"


class TutorPolicy:
    prerequisite_threshold = 0.70

    def select_next_concept(
        self,
        graph: KnowledgeGraph,
        mastery_by_concept: Mapping[str, float],
        exclude_id: str | None = None,
    ) -> GraphConcept | None:
        candidates = []
        for concept in graph.concepts.values():
            mastery = float(mastery_by_concept.get(concept.id, 0.0))
            if concept.id == exclude_id or mastery >= 0.85:
                continue
            prerequisites = graph.prerequisites(concept.id)
            if all(
                float(mastery_by_concept.get(item.id, 0.0)) >= self.prerequisite_threshold
                for item in prerequisites
            ):
                candidates.append((-len(prerequisites), concept.difficulty, mastery, concept.name, concept))
        return min(candidates, default=(None, None, None, None, None))[-1]

    def action_for(
        self,
        concept: GraphConcept | None,
        mastery: float,
        *,
        has_evidence: bool,
    ) -> TutorAction:
        if concept is None:
            return TutorAction.ANSWER
        if mastery < 0.40:
            return TutorAction.REVIEW if has_evidence else TutorAction.TEACH_NEW
        if mastery < 0.70:
            return TutorAction.REVIEW
        if mastery < 0.85:
            return TutorAction.ASSESS
        return TutorAction.ANSWER


tutor_policy = TutorPolicy()
