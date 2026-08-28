import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.storage.postgres import Base


class LearnerConcept(Base):
    __tablename__ = "learner_concepts"
    __table_args__ = (
        UniqueConstraint(
            "learner_id", "space_id", "concept_id", name="uq_learner_concept_scope"
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    space_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("learning_spaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    concept_id: Mapped[str] = mapped_column(
        String, ForeignKey("concepts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    mastery: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pending_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_expected: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
