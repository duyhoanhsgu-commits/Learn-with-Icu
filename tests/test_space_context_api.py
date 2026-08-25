import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.agent.context import MAX_FIXED_CONTEXT_CHARS
from src.api.routes.spaces import get_space_context, update_space_context
from src.api.schemas import SpaceContextUpdate
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
async def test_get_and_update_space_context_api():
    space = LearningSpace(id="space-a", name="A", color="blue")
    session = FakeSession([space])

    empty = await get_space_context("space-a", session)
    updated = await update_space_context(
        "space-a",
        SpaceContextUpdate(fixed_context="Persistent learning goal"),
        session,
    )
    loaded = await get_space_context("space-a", session)

    assert empty.fixed_context == ""
    assert updated.updated is True
    assert updated.fixed_context == "Persistent learning goal"
    assert loaded.fixed_context == "Persistent learning goal"


@pytest.mark.asyncio
async def test_space_context_api_rejects_invalid_space():
    with pytest.raises(HTTPException) as error:
        await get_space_context("missing", FakeSession())

    assert error.value.status_code == 404


def test_space_context_update_schema_rejects_oversized_value():
    with pytest.raises(ValidationError) as error:
        SpaceContextUpdate(fixed_context="x" * (MAX_FIXED_CONTEXT_CHARS + 1))

    assert "at most 12000 characters" in str(error.value)
