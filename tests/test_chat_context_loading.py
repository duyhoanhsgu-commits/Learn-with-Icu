import pytest
from fastapi import HTTPException

from src.agent.state import AgentState
from src.api.routes.chat import load_fixed_context, load_recent_history
from src.api.schemas import ChatQueryRequest, GeneralChatRequest
from src.storage.postgres import ChatConversation, LearningSpace


class FakeSession:
    def __init__(self, spaces=None, conversations=None):
        self.spaces = {space.id: space for space in (spaces or [])}
        self.conversations = {
            conversation.id: conversation for conversation in (conversations or [])
        }

    async def get(self, model, identifier):
        if model is LearningSpace:
            return self.spaces.get(identifier)
        if model is ChatConversation:
            return self.conversations.get(identifier)
        raise AssertionError(f"Unexpected model: {model}")


@pytest.mark.asyncio
async def test_chat_boundary_loads_only_requested_space_context():
    session = FakeSession(spaces=[
        LearningSpace(id="space-a", name="A", color="blue", fixed_context="Context A"),
        LearningSpace(id="space-b", name="B", color="teal", fixed_context="Context B"),
    ])

    assert await load_fixed_context(session, "space-a") == "Context A"


@pytest.mark.asyncio
async def test_chat_boundary_rejects_invalid_space():
    with pytest.raises(HTTPException) as error:
        await load_fixed_context(FakeSession(), "missing")

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_recent_history_rejects_conversation_from_another_space():
    conversation = ChatConversation(
        id="conversation-1",
        title="Chat",
        chat_type="learning",
        space_id="space-a",
    )
    session = FakeSession(conversations=[conversation])

    with pytest.raises(HTTPException) as error:
        await load_recent_history(
            session,
            "conversation-1",
            chat_type="learning",
            space_id="space-b",
        )

    assert error.value.status_code == 409


def test_agent_state_and_general_request_support_fixed_space_context():
    request = GeneralChatRequest(
        question="What should I learn next?",
        space_id="space-a",
    )
    state = AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
        fixed_context="Learning RAG",
    )

    assert state.fixed_context == "Learning RAG"
    assert ChatQueryRequest.model_fields["space_id"].is_required()
