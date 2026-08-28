import re
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from src.knowledge import KnowledgeRepository, knowledge_repository
from src.learner import (
    EvaluationUnavailableError,
    LearnerEvaluator,
    LearnerRepository,
    learner_evaluator,
    learner_repository,
)
from src.learner.mastery import mastery_status
from src.rag.generator import RAGGenerator, generator
from src.rag.pipeline import RAGPipeline, rag_pipeline
from src.rag.retriever import RAGRetriever, retriever
from src.tutor.planner import TutorPlanner, tutor_planner
from src.tutor.intents import TutorIntent, detect_tutor_intent
from src.tutor.policy import TutorAction
from src.tutor.prompts import ASSESSMENT_PROMPT, TUTOR_SYSTEM_PROMPT

_SELF_REPORT_PATTERN = re.compile(r"\b(i (?:already )?(?:know|understand)|tôi (?:đã )?(?:biết|hiểu))\b", re.I)


@dataclass(frozen=True)
class TutorResult:
    answer: str
    sources: list[dict]
    action: TutorAction
    concept_id: str | None
    reason: str


class TutorService:
    def __init__(
        self,
        *,
        knowledge: KnowledgeRepository | None = None,
        learners: LearnerRepository | None = None,
        evaluator: LearnerEvaluator | None = None,
        planner: TutorPlanner | None = None,
        rag: RAGPipeline | None = None,
        rag_retriever: RAGRetriever | None = None,
        rag_generator: RAGGenerator | None = None,
    ):
        self.knowledge = knowledge or knowledge_repository
        self.learners = learners or learner_repository
        self.evaluator = evaluator or learner_evaluator
        self.planner = planner or tutor_planner
        self.rag = rag or rag_pipeline
        self.retriever = rag_retriever or retriever
        self.generator = rag_generator or generator

    async def _retrieve(self, concept, space_id: str, top_k: int) -> list[dict]:
        return await self.retriever.retrieve(
            query=f"{concept.name}: {concept.summary}",
            top_k=top_k,
            score_threshold=0.0,
            filter_dict={"space_id": space_id},
        )

    async def respond(
        self,
        *,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        message: str,
        history: list[dict[str, str]],
        top_k: int = 5,
        fixed_context: str | None = None,
        memory_context: str | None = None,
    ) -> TutorResult:
        pending = await self.learners.pending_assessment(db, learner_id, space_id)
        if pending is not None:
            concept = await self.knowledge.get_concept(db, pending.concept_id, space_id)
            if concept is not None:
                try:
                    evaluation = await self.evaluator.evaluate(
                        concept_name=concept.name,
                        question=pending.pending_question or "",
                        expected_context=pending.pending_expected or concept.summary,
                        user_answer=message,
                        previous_mastery=pending.mastery,
                    )
                except EvaluationUnavailableError:
                    return TutorResult(
                        answer=(
                            "I saved the assessment question, but evaluation is temporarily "
                            "unavailable. Your mastery was not changed; you can resume this "
                            "assessment later."
                        ),
                        sources=[],
                        action=TutorAction.ASSESS,
                        concept_id=concept.id,
                        reason="Evaluation unavailable; learner state was preserved.",
                    )
                updated = await self.learners.apply_evaluation(
                    db, learner_id, space_id, concept.id, evaluation
                )
                await db.commit()
                answer = (
                    f"{evaluation.feedback}\n\n"
                    f"**Updated understanding:** {updated.mastery:.0%} "
                    f"({mastery_status(updated.mastery)})."
                )
                return TutorResult(
                    answer=answer,
                    sources=[],
                    action=TutorAction.ASSESS,
                    concept_id=concept.id,
                    reason="Evaluated the pending grounded assessment response.",
                )

        graph = await self.knowledge.graph(db, space_id)
        states = await self.learners.list(db, learner_id, space_id)
        mastery = {item.concept_id: item.mastery for item in states}
        evidence = {
            item.concept_id for item in states
            if item.correct_count or item.wrong_count or item.last_reviewed_at
        }
        intent = detect_tutor_intent(message)
        concept_hint = self.planner.identify_concept(message, graph)
        if concept_hint is None and intent == TutorIntent.STRUGGLE:
            for entry in reversed(history):
                concept_hint = self.planner.identify_concept(entry.get("content", ""), graph)
                if concept_hint is not None:
                    break
        plan = self.planner.plan(
            message=message,
            graph=graph,
            mastery_by_concept=mastery,
            evidence_concepts=evidence,
            intent=intent,
            concept_hint=concept_hint,
        )
        concept = graph.concepts.get(plan.concept_id) if plan.concept_id else None
        if concept is None or plan.action == TutorAction.ANSWER:
            result = await self.rag.answer_question(
                query=message,
                top_k=top_k,
                filter_dict={"space_id": space_id},
                fixed_context=fixed_context,
                memory_context=memory_context,
                history=history,
            )
            return TutorResult(
                answer=result["answer"],
                sources=result["sources"],
                action=TutorAction.ANSWER,
                concept_id=concept.id if concept else None,
                reason=plan.reason,
            )

        if _SELF_REPORT_PATTERN.search(message):
            await self.learners.note_self_report(db, learner_id, space_id, concept.id)
        if intent == TutorIntent.STRUGGLE:
            await self.learners.note_struggle(db, learner_id, space_id, concept.id)

        contexts = await self._retrieve(concept, space_id, top_k)
        current_mastery = float(mastery.get(concept.id, 0.0))
        if plan.action == TutorAction.ASSESS:
            question = await self.generator.generate_response(
                query=f"Focus concept: {concept.name}\n{ASSESSMENT_PROMPT}",
                contexts=contexts,
                system_prompt=TUTOR_SYSTEM_PROMPT,
                fixed_context=fixed_context,
                memory_context=memory_context,
                history=history,
            )
            expected = "\n\n".join(item.get("text", "") for item in contexts) or concept.summary
            await self.learners.set_pending_assessment(
                db, learner_id, space_id, concept.id, question, expected
            )
            await db.commit()
            return TutorResult(question, contexts, plan.action, concept.id, plan.reason)

        instruction = (
            f"Tutor action: {plan.action.value}. Focus concept: {concept.name}. "
            f"Current mastery: {current_mastery:.2f}. Planner reason: {plan.reason}\n\n"
            f"Learner request: {message}"
        )
        answer = await self.generator.generate_response(
            query=instruction,
            contexts=contexts,
            system_prompt=TUTOR_SYSTEM_PROMPT,
            fixed_context=fixed_context,
            memory_context=memory_context,
            history=history,
        )
        await db.commit()
        return TutorResult(answer, contexts, plan.action, concept.id, plan.reason)


tutor_service = TutorService()
