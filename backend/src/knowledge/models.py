import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.storage.postgres import Base


class Concept(Base):
    __tablename__ = "concepts"
    __table_args__ = (UniqueConstraint("space_id", "name_key", name="uq_concepts_space_name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("learning_spaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    name_key: Mapped[str] = mapped_column(String(240), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ConceptEdge(Base):
    __tablename__ = "concept_edges"
    __table_args__ = (
        UniqueConstraint(
            "space_id",
            "source_concept_id",
            "target_concept_id",
            "relation",
            name="uq_concept_edges_relation",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("learning_spaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_concept_id: Mapped[str] = mapped_column(
        String, ForeignKey("concepts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_concept_id: Mapped[str] = mapped_column(
        String, ForeignKey("concepts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    relation: Mapped[str] = mapped_column(String(40), nullable=False)


class ConceptSource(Base):
    __tablename__ = "concept_sources"

    concept_id: Mapped[str] = mapped_column(
        String, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True
    )
    chunk_id: Mapped[str] = mapped_column(
        String, ForeignKey("document_chunks.id", ondelete="CASCADE"), primary_key=True
    )
