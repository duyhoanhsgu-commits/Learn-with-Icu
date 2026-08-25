from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.agent.context.memory import (
    MAX_RELEVANT_MEMORIES,
    LongTermMemoryNotFoundError,
    LongTermMemoryStore,
    PersonalContextService,
)
from src.api.schemas import LongTermMemoryPayload
from src.storage.postgres import LearningSpace, LongTermMemory


class FakeScalars:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return FakeScalars(self.values)

    def scalar_one_or_none(self):
        return self.values[0] if self.values else None


class FakeSession:
    def __init__(self, spaces=None, memories=None):
        self.spaces = {space.id: space for space in (spaces or [])}
        self.memories = {memory.id: memory for memory in (memories or [])}
        self.added = []
        self.deleted = []
        self.commits = 0

    async def get(self, model, identifier):
        if model is LearningSpace:
            return self.spaces.get(identifier)
        raise AssertionError(f"Unexpected get model: {model}")

    async def execute(self, statement):
        params = statement.compile().params.values()
        strings = {value for value in params if isinstance(value, str)}
        values = [
            memory for memory in self.memories.values()
            if memory.space_id in strings
            and (memory.id in strings or len(strings) == 1)
        ]
        return FakeResult(values)

    def add(self, value):
        self.added.append(value)
        if isinstance(value, LongTermMemory):
            self.memories[value.id] = value

    async def delete(self, value):
        self.deleted.append(value)
        self.memories.pop(value.id, None)

    async def commit(self):
        self.commits += 1

    async def refresh(self, value):
        now = datetime.now(timezone.utc)
        value.created_at = value.created_at or now
        value.updated_at = value.updated_at or now


def memory(memory_id, space_id, key, value, importance=0.5, category="fact"):
    now = datetime.now(timezone.utc)
    return LongTermMemory(
        id=memory_id,
        space_id=space_id,
        category=category,
        key=key,
        value=value,
        importance=importance,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_memory_crud_is_scoped_to_space():
    spaces = [
        LearningSpace(id="space-a", name="A", color="blue"),
        LearningSpace(id="space-b", name="B", color="teal"),
    ]
    existing = memory("memory-a", "space-a", "database", "Use Qdrant")
    session = FakeSession(spaces, [existing])
    store = LongTermMemoryStore()

    created = await store.create(
        session,
        "space-a",
        category="goal",
        key="career",
        value="Become an AI Engineer",
        importance=0.9,
    )
    updated = await store.update(
        session,
        "space-a",
        created.id,
        category="goal",
        key="career",
        value="Become a RAG Engineer",
        importance=1.0,
    )

    assert updated.value == "Become a RAG Engineer"
    with pytest.raises(LongTermMemoryNotFoundError):
        await store.get(session, "space-b", "memory-a")

    await store.delete(session, "space-a", created.id)
    assert created in session.deleted


@pytest.mark.asyncio
async def test_personal_context_selects_bounded_relevant_memories():
    space = LearningSpace(
        id="space-a",
        name="A",
        color="blue",
        fixed_context="Project: Learn-with-Icu",
    )
    memories = [
        memory(
            f"memory-{index}",
            "space-a",
            f"decision-{index}",
            "Use Qdrant retrieval" if index == 10 else f"unrelated value {index}",
            importance=index / 20,
            category="technical_decision",
        )
        for index in range(12)
    ]
    context = await PersonalContextService().load(
        FakeSession([space], memories),
        "space-a",
        "How should Qdrant retrieval work?",
    )

    assert context.fixed_context == "Project: Learn-with-Icu"
    assert "Use Qdrant retrieval" in context.memory_context
    assert len(context.memory_context.splitlines()) == MAX_RELEVANT_MEMORIES


def test_memory_payload_validates_category_lengths_and_importance():
    with pytest.raises(ValidationError):
        LongTermMemoryPayload(
            category="secret",
            key="key",
            value="value",
            importance=2,
        )


def test_long_term_memory_table_is_space_scoped():
    table = LongTermMemory.__table__

    assert table.columns["space_id"].index is True
    assert next(iter(table.columns["space_id"].foreign_keys)).target_fullname == "learning_spaces.id"
