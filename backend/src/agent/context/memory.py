from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres import LearningSpace, LongTermMemory

MAX_FIXED_CONTEXT_CHARS = 12_000
MAX_RELEVANT_MEMORIES = 8
MAX_MEMORY_CANDIDATES = 50
_WORD_PATTERN = re.compile(r"\w+", flags=re.UNICODE)


class SpaceNotFoundError(LookupError):
    pass


class FixedContextTooLongError(ValueError):
    pass


class LongTermMemoryNotFoundError(LookupError):
    pass


class SpaceContextMemory:
    """Persistent fixed context boundary for a single learning space."""

    @staticmethod
    def validate(fixed_context: str) -> str:
        if len(fixed_context) > MAX_FIXED_CONTEXT_CHARS:
            raise FixedContextTooLongError(
                f"Fixed context exceeds maximum allowed length of "
                f"{MAX_FIXED_CONTEXT_CHARS} characters."
            )
        return fixed_context

    async def get(self, db: AsyncSession, space_id: str) -> str:
        space = await db.get(LearningSpace, space_id)
        if space is None:
            raise SpaceNotFoundError(space_id)
        return space.fixed_context or ""

    async def update(
        self,
        db: AsyncSession,
        space_id: str,
        fixed_context: str,
    ) -> str:
        value = self.validate(fixed_context)
        space = await db.get(LearningSpace, space_id)
        if space is None:
            raise SpaceNotFoundError(space_id)
        space.fixed_context = value
        await db.commit()
        return value


space_context_memory = SpaceContextMemory()


class LongTermMemoryStore:
    """Explicit, space-scoped long-term memory storage and lexical selection."""

    @staticmethod
    async def _require_space(db: AsyncSession, space_id: str) -> None:
        if await db.get(LearningSpace, space_id) is None:
            raise SpaceNotFoundError(space_id)

    async def list(
        self,
        db: AsyncSession,
        space_id: str,
        *,
        limit: int | None = None,
    ) -> list[LongTermMemory]:
        await self._require_space(db, space_id)
        statement = (
            select(LongTermMemory)
            .where(LongTermMemory.space_id == space_id)
            .order_by(LongTermMemory.importance.desc(), LongTermMemory.updated_at.desc())
        )
        if limit is not None:
            statement = statement.limit(limit)
        result = await db.execute(statement)
        return list(result.scalars().all())

    async def get(
        self,
        db: AsyncSession,
        space_id: str,
        memory_id: str,
    ) -> LongTermMemory:
        await self._require_space(db, space_id)
        result = await db.execute(
            select(LongTermMemory).where(
                LongTermMemory.id == memory_id,
                LongTermMemory.space_id == space_id,
            )
        )
        memory = result.scalar_one_or_none()
        if memory is None:
            raise LongTermMemoryNotFoundError(memory_id)
        return memory

    async def create(
        self,
        db: AsyncSession,
        space_id: str,
        *,
        category: str,
        key: str,
        value: str,
        importance: float,
    ) -> LongTermMemory:
        await self._require_space(db, space_id)
        memory = LongTermMemory(
            id=str(uuid.uuid4()),
            space_id=space_id,
            category=category,
            key=key,
            value=value,
            importance=importance,
        )
        db.add(memory)
        await db.commit()
        await db.refresh(memory)
        return memory

    async def update(
        self,
        db: AsyncSession,
        space_id: str,
        memory_id: str,
        *,
        category: str,
        key: str,
        value: str,
        importance: float,
    ) -> LongTermMemory:
        memory = await self.get(db, space_id, memory_id)
        memory.category = category
        memory.key = key
        memory.value = value
        memory.importance = importance
        memory.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(memory)
        return memory

    async def delete(
        self,
        db: AsyncSession,
        space_id: str,
        memory_id: str,
    ) -> None:
        memory = await self.get(db, space_id, memory_id)
        await db.delete(memory)
        await db.commit()

    @staticmethod
    def _terms(value: str) -> set[str]:
        return {
            token.casefold()
            for token in _WORD_PATTERN.findall(value)
            if len(token) >= 3
        }

    async def relevant(
        self,
        db: AsyncSession,
        space_id: str,
        query: str,
    ) -> list[LongTermMemory]:
        candidates = await self.list(
            db,
            space_id,
            limit=MAX_MEMORY_CANDIDATES,
        )
        return self.select_relevant(candidates, query)

    def select_relevant(
        self,
        candidates: list[LongTermMemory],
        query: str,
    ) -> list[LongTermMemory]:
        query_terms = self._terms(query)

        def rank(memory: LongTermMemory) -> tuple[float, float]:
            memory_terms = self._terms(
                f"{memory.category} {memory.key} {memory.value}"
            )
            overlap = len(query_terms & memory_terms) / max(1, len(query_terms))
            return overlap + (memory.importance * 0.35), memory.importance

        return sorted(candidates, key=rank, reverse=True)[:MAX_RELEVANT_MEMORIES]

    @staticmethod
    def format_for_prompt(memories: list[LongTermMemory]) -> str:
        return "\n".join(
            f"- [{memory.category}] {memory.key}: {memory.value}"
            for memory in memories
        )


long_term_memory_store = LongTermMemoryStore()


@dataclass(frozen=True)
class PersonalContext:
    fixed_context: str = ""
    memory_context: str = ""


class PersonalContextService:
    """Load all prompt-ready personal context once at the chat boundary."""

    async def load(
        self,
        db: AsyncSession,
        space_id: str,
        query: str,
    ) -> PersonalContext:
        space = await db.get(LearningSpace, space_id)
        if space is None:
            raise SpaceNotFoundError(space_id)
        result = await db.execute(
            select(LongTermMemory)
            .where(LongTermMemory.space_id == space_id)
            .order_by(
                LongTermMemory.importance.desc(),
                LongTermMemory.updated_at.desc(),
            )
            .limit(MAX_MEMORY_CANDIDATES)
        )
        memories = long_term_memory_store.select_relevant(
            list(result.scalars().all()),
            query,
        )
        return PersonalContext(
            fixed_context=space.fixed_context or "",
            memory_context=long_term_memory_store.format_for_prompt(memories),
        )


personal_context_service = PersonalContextService()
