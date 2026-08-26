from datetime import datetime, timezone

import pytest

from src.agent.context.memory import (
    GlobalLongTermMemoryStore,
    LongTermMemoryNotFoundError,
    PersonalContextService,
)
from src.storage.postgres import GlobalLongTermMemory, LearningSpace, LongTermMemory


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


class FakeSession:
    def __init__(self, spaces=None, global_memories=None, local_memories=None):
        self.spaces = {space.id: space for space in (spaces or [])}
        self.global_memories = {memory.id: memory for memory in (global_memories or [])}
        self.local_memories = list(local_memories or [])
        self.deleted = []

    async def get(self, model, identifier):
        if model is LearningSpace:
            return self.spaces.get(identifier)
        if model is GlobalLongTermMemory:
            return self.global_memories.get(identifier)
        raise AssertionError(f"Unexpected model: {model}")

    async def execute(self, statement):
        entity = statement.column_descriptions[0].get("entity")
        if entity is GlobalLongTermMemory:
            return FakeResult(list(self.global_memories.values()))
        if entity is LongTermMemory:
            space_ids = {
                value for value in statement.compile().params.values()
                if isinstance(value, str)
            }
            return FakeResult([
                memory for memory in self.local_memories
                if memory.space_id in space_ids
            ])
        raise AssertionError(f"Unexpected statement entity: {entity}")

    def add(self, value):
        self.global_memories[value.id] = value

    async def delete(self, value):
        self.deleted.append(value)
        self.global_memories.pop(value.id, None)

    async def commit(self):
        pass

    async def refresh(self, value):
        now = datetime.now(timezone.utc)
        value.created_at = value.created_at or now
        value.updated_at = value.updated_at or now


def global_memory(memory_id, key, value, importance=0.8):
    now = datetime.now(timezone.utc)
    return GlobalLongTermMemory(
        id=memory_id,
        category="preference",
        key=key,
        value=value,
        importance=importance,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_global_memory_crud_does_not_require_a_learning_space():
    session = FakeSession()
    store = GlobalLongTermMemoryStore()

    created = await store.create(
        session,
        category="goal",
        key="learning_goal",
        value="Master production RAG",
        importance=0.9,
    )
    updated = await store.update(
        session,
        created.id,
        category="goal",
        key="learning_goal",
        value="Build production RAG systems",
        importance=1.0,
    )

    assert updated.value == "Build production RAG systems"
    await store.delete(session, created.id)
    with pytest.raises(LongTermMemoryNotFoundError):
        await store.get(session, created.id)


@pytest.mark.asyncio
async def test_general_chat_context_loads_global_memory_without_space():
    session = FakeSession(global_memories=[
        global_memory("global-1", "response_style", "Explain step by step"),
    ])

    context = await PersonalContextService().load(
        session,
        None,
        "Explain this concept",
    )

    assert context.fixed_context == ""
    assert "Explain step by step" in context.memory_context


@pytest.mark.asyncio
async def test_learning_context_combines_global_memory_and_workspace_context():
    space = LearningSpace(
        id="space-a",
        name="RAG",
        color="blue",
        fixed_context="Workspace objective: learn retrieval",
    )
    local = LongTermMemory(
        id="local-1",
        space_id="space-a",
        category="technical_decision",
        key="vector_store",
        value="Use Qdrant",
        importance=0.9,
    )
    session = FakeSession(
        spaces=[space],
        global_memories=[global_memory("global-1", "current_role", "AI Engineer")],
        local_memories=[local],
    )

    context = await PersonalContextService().load(
        session,
        "space-a",
        "How should this AI retrieval project use Qdrant?",
    )

    assert context.fixed_context == "Workspace objective: learn retrieval"
    assert "AI Engineer" in context.memory_context
    assert "Use Qdrant" in context.memory_context
