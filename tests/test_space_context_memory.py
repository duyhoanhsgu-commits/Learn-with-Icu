import pytest

from src.agent.context.memory import (
    MAX_FIXED_CONTEXT_CHARS,
    FixedContextTooLongError,
    SpaceContextMemory,
    SpaceNotFoundError,
)
from src.storage.postgres import LearningSpace


class FakeSession:
    def __init__(self, spaces=None):
        self.spaces = {space.id: space for space in (spaces or [])}
        self.commits = 0

    async def get(self, model, identifier):
        assert model is LearningSpace
        return self.spaces.get(identifier)

    async def commit(self):
        self.commits += 1


@pytest.mark.asyncio
async def test_context_update_persists_for_later_reads():
    space = LearningSpace(id="space-a", name="A", color="blue")
    session = FakeSession([space])
    memory = SpaceContextMemory()

    await memory.update(session, "space-a", "Learning RAG")

    assert await memory.get(session, "space-a") == "Learning RAG"
    assert session.commits == 1


@pytest.mark.asyncio
async def test_context_is_isolated_by_exact_space_id():
    first = LearningSpace(id="space-a", name="A", color="blue", fixed_context="Context A")
    second = LearningSpace(id="space-b", name="B", color="teal", fixed_context="Context B")
    memory = SpaceContextMemory()
    session = FakeSession([first, second])

    assert await memory.get(session, "space-a") == "Context A"
    assert await memory.get(session, "space-b") == "Context B"


@pytest.mark.asyncio
async def test_invalid_space_is_rejected():
    with pytest.raises(SpaceNotFoundError):
        await SpaceContextMemory().get(FakeSession(), "missing")


def test_fixed_context_length_is_validated_without_truncation():
    valid = "x" * MAX_FIXED_CONTEXT_CHARS
    assert SpaceContextMemory.validate(valid) == valid

    with pytest.raises(FixedContextTooLongError, match="exceeds maximum"):
        SpaceContextMemory.validate(valid + "x")
