import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy import String, DateTime, Float, Integer, Text, ForeignKey, JSON, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class LearningSpace(Base):
    __tablename__ = "learning_spaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, default="blue", nullable=False)
    fixed_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    documents = relationship("Document", back_populates="space", cascade="all, delete-orphan")
    learning_tools = relationship("LearningTool", back_populates="space", cascade="all, delete-orphan")
    memories = relationship("LongTermMemory", back_populates="space", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    space_id: Mapped[str] = mapped_column(String, ForeignKey("learning_spaces.id"), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, processing, completed, failed
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    meta_info: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    owner = relationship("User", back_populates="documents")
    space = relationship("LearningSpace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    vector_id: Mapped[str] = mapped_column(String, nullable=True)
    meta_info: Mapped[dict] = mapped_column(JSON, default=dict)

    document = relationship("Document", back_populates="chunks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    session_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, default="New conversation", nullable=False)
    chat_type: Mapped[str] = mapped_column(String, default="general", index=True, nullable=False)
    space_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_compacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LongTermMemory(Base):
    __tablename__ = "long_term_memories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("learning_spaces.id"),
        index=True,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(String, index=True, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    space = relationship("LearningSpace", back_populates="memories")


class GlobalLongTermMemory(Base):
    """User profile memory shared by every chat and learning space.

    Authentication is not wired into this single-user application yet, so this
    table intentionally represents the one global ICU profile.
    """

    __tablename__ = "global_long_term_memories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category: Mapped[str] = mapped_column(String, index=True, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LearningTool(Base):
    __tablename__ = "learning_tools"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    space_id: Mapped[str] = mapped_column(
        String, ForeignKey("learning_spaces.id"), index=True, nullable=False
    )
    tool_type: Mapped[str] = mapped_column("type", String, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    space = relationship("LearningSpace", back_populates="learning_tools")


async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all does not alter existing tables. Upgrade early development
        # databases in place and preserve their documents in one real space.
        await conn.execute(text(
            "ALTER TABLE learning_spaces "
            "ADD COLUMN IF NOT EXISTS fixed_context TEXT"
        ))
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS space_id VARCHAR"))
        await conn.execute(text("""
            INSERT INTO learning_spaces (id, name, color, created_at)
            SELECT 'legacy-imports', 'Imported documents', 'blue', NOW()
            WHERE EXISTS (SELECT 1 FROM documents WHERE space_id IS NULL)
              AND NOT EXISTS (SELECT 1 FROM learning_spaces WHERE id = 'legacy-imports')
        """))
        await conn.execute(text("UPDATE documents SET space_id = 'legacy-imports' WHERE space_id IS NULL"))
        await conn.execute(text("ALTER TABLE documents ALTER COLUMN space_id SET NOT NULL"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_space_id ON documents (space_id)"))
        await conn.execute(text(
            "ALTER TABLE chat_conversations "
            "ADD COLUMN IF NOT EXISTS context_summary TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE chat_conversations "
            "ADD COLUMN IF NOT EXISTS context_compacted_at TIMESTAMPTZ"
        ))


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
