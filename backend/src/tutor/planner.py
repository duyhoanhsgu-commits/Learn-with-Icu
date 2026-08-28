from dataclasses import dataclass
from typing import Mapping

from src.knowledge.graph import GraphConcept, KnowledgeGraph
from src.tutor.intents import TutorIntent, detect_tutor_intent
from src.tutor.policy import TutorAction, TutorPolicy, tutor_policy


@dataclass(frozen=True)
class TutorPlan:
    action: TutorAction
    concept_id: str | None
    reason: str
    retrieve_sources: bool = True


class TutorPlanner:
    def __init__(self, policy: TutorPolicy | None = None):
        self.policy = policy or tutor_policy

    @staticmethod
    def identify_concept(message: str, graph: KnowledgeGraph) -> GraphConcept | None:
        query = " ".join(message.casefold().split())
        direct = [item for item in graph.concepts.values() if item.name.casefold() in query]
        if direct:
            return max(direct, key=lambda item: len(item.name))

        query_tokens = set(query.split())
        scored = []
        for concept in graph.concepts.values():
            concept_tokens = set(concept.name.casefold().split())
            overlap = len(query_tokens & concept_tokens)
            if overlap:
                scored.append((overlap / max(1, len(concept_tokens)), -concept.difficulty, concept))
        return max(scored, default=(0, 0, None), key=lambda item: (item[0], item[1]))[-1]

    def diagnostic_candidates(
        self,
        graph: KnowledgeGraph,
        mastery_by_concept: Mapping[str, float],
        limit: int = 5,
    ) -> list[GraphConcept]:
        candidates = [
            concept for concept in graph.concepts.values()
            if float(mastery_by_concept.get(concept.id, 0.0)) < 0.30
        ]
        candidates.sort(key=lambda item: (len(graph.prerequisites(item.id)), item.difficulty, item.name))
        return candidates[:limit]

    def plan(
        self,
        *,
        message: str,
        graph: KnowledgeGraph,
        mastery_by_concept: Mapping[str, float],
        evidence_concepts: set[str] | None = None,
        diagnostic: bool = False,
        intent: TutorIntent | None = None,
        concept_hint: GraphConcept | None = None,
    ) -> TutorPlan:
        evidence = evidence_concepts or set()
        resolved_intent = intent or detect_tutor_intent(message)
        if diagnostic or resolved_intent == TutorIntent.DIAGNOSTIC:
            candidates = self.diagnostic_candidates(graph, mastery_by_concept)
            concept = candidates[0] if candidates else None
            return TutorPlan(
                action=TutorAction.ASSESS if concept else TutorAction.ANSWER,
                concept_id=concept.id if concept else None,
                reason=(
                    f"Diagnostic starts with foundational concept {concept.name}."
                    if concept else "No unknown diagnostic concept is available."
                ),
                retrieve_sources=concept is not None,
            )

        concept = concept_hint or self.identify_concept(message, graph)
        if concept is None:
            concept = self.policy.select_next_concept(graph, mastery_by_concept)
        if concept is None:
            return TutorPlan(TutorAction.ANSWER, None, "No graph concept matched the request.")

        mastery = float(mastery_by_concept.get(concept.id, 0.0))
        if resolved_intent == TutorIntent.ASSESS:
            action = TutorAction.ASSESS
            reason = f"The learner requested an assessment of {concept.name}."
        elif resolved_intent in {TutorIntent.STRUGGLE, TutorIntent.REVIEW}:
            action = TutorAction.REVIEW
            reason = f"The learner reported difficulty with {concept.name}."
        else:
            action = self.policy.action_for(concept, mastery, has_evidence=concept.id in evidence)
            reason = f"{concept.name} has mastery {mastery:.2f}; policy selected {action.value}."
        if action == TutorAction.ANSWER and mastery >= 0.85:
            next_concept = self.policy.select_next_concept(
                graph, mastery_by_concept, exclude_id=concept.id
            )
            if next_concept is not None:
                return TutorPlan(
                    TutorAction.TEACH_NEW,
                    next_concept.id,
                    f"{concept.name} is mastered; prerequisites permit {next_concept.name} next.",
                )
        return TutorPlan(
            action=action,
            concept_id=concept.id,
            reason=reason,
        )


tutor_planner = TutorPlanner()
