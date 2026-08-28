from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.knowledge.models import Concept
from src.learner.evaluator import EvaluationResult
from src.learner.mastery import apply_self_report, apply_struggle_report, update_mastery
from src.learner.models import LearnerConcept


class LearnerRepository:
    async def list(
        self, db: AsyncSession, learner_id: str, space_id: str
    ) -> list[LearnerConcept]:
        result = await db.execute(
            select(LearnerConcept)
            .where(
                LearnerConcept.learner_id == learner_id,
                LearnerConcept.space_id == space_id,
            )
            .order_by(LearnerConcept.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
    ) -> LearnerConcept | None:
        result = await db.execute(
            select(LearnerConcept).where(
                LearnerConcept.learner_id == learner_id,
                LearnerConcept.space_id == space_id,
                LearnerConcept.concept_id == concept_id,
            )
        )
        scalars = result.scalars()
        if hasattr(scalars, "first"):
            return scalars.first()
        items = list(scalars.all())
        return items[0] if items else None

    async def get_or_create(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
    ) -> LearnerConcept:
        concept = await db.get(Concept, concept_id)
        if concept is None or concept.space_id != space_id:
            raise ValueError("Concept not found in this learning space.")
        state = await self.get(db, learner_id, space_id, concept_id)
        if state is None:
            state = LearnerConcept(
                learner_id=learner_id,
                space_id=space_id,
                concept_id=concept_id,
            )
            db.add(state)
            await db.flush()
        return state

    async def apply_evaluation(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
        evaluation: EvaluationResult,
    ) -> LearnerConcept:
        state = await self.get_or_create(db, learner_id, space_id, concept_id)
        update = update_mastery(
            state.mastery,
            state.confidence,
            correctness=evaluation.correctness,
            completeness=evaluation.completeness,
            understanding=evaluation.understanding,
        )
        state.mastery = update.mastery
        state.confidence = update.confidence
        state.correct_count += update.correct_delta
        state.wrong_count += update.wrong_delta
        state.last_reviewed_at = datetime.now(timezone.utc)
        state.pending_question = None
        state.pending_expected = None
        state.pending_since = None
        state.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return state

    async def note_self_report(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
    ) -> LearnerConcept:
        state = await self.get_or_create(db, learner_id, space_id, concept_id)
        update = apply_self_report(state.mastery, state.confidence)
        state.mastery = update.mastery
        state.confidence = update.confidence
        state.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return state

    async def set_pending_assessment(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
        question: str,
        expected_context: str,
    ) -> LearnerConcept:
        state = await self.get_or_create(db, learner_id, space_id, concept_id)
        state.pending_question = question
        state.pending_expected = expected_context
        state.pending_since = datetime.now(timezone.utc)
        await db.flush()
        return state

    async def note_struggle(
        self,
        db: AsyncSession,
        learner_id: str,
        space_id: str,
        concept_id: str,
    ) -> LearnerConcept:
        state = await self.get_or_create(db, learner_id, space_id, concept_id)
        update = apply_struggle_report(state.mastery, state.confidence)
        state.mastery = update.mastery
        state.confidence = update.confidence
        state.last_reviewed_at = datetime.now(timezone.utc)
        state.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return state

    async def pending_assessment(
        self, db: AsyncSession, learner_id: str, space_id: str
    ) -> LearnerConcept | None:
        result = await db.execute(
            select(LearnerConcept)
            .where(
                LearnerConcept.learner_id == learner_id,
                LearnerConcept.space_id == space_id,
                LearnerConcept.pending_question.is_not(None),
            )
            .order_by(LearnerConcept.pending_since.desc())
            .limit(1)
        )
        scalars = result.scalars()
        if hasattr(scalars, "first"):
            return scalars.first()
        items = list(scalars.all())
        return items[0] if items else None


learner_repository = LearnerRepository()
