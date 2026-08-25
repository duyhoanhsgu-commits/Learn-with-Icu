import pytest

from src.api.routes.chat import conversation_title, persist_exchange
from src.rag.generator import RAGGenerator
from src.storage.postgres import ChatConversation, ChatMessage


class FakeSession:
    def __init__(self, conversation=None):
        self.conversation = conversation
        self.added = []
        self.commits = 0

    async def get(self, model, identifier):
        assert model is ChatConversation
        return self.conversation if self.conversation and self.conversation.id == identifier else None

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1


def test_conversation_title_is_compact_and_bounded():
    assert conversation_title("  Explain   recursion  ") == "Explain recursion"
    assert len(conversation_title("word " * 40)) <= 72


def test_general_messages_include_only_recent_valid_conversation_history():
    history = [
        {"role": "system", "content": "ignore me"},
        {"role": "user", "content": "My topic is recursion."},
        {"role": "assistant", "content": "Understood."},
    ]

    messages = RAGGenerator._build_general_messages("What was my topic?", history)

    assert [message["role"] for message in messages] == ["system", "user", "assistant", "user"]
    assert messages[-2]["content"] == "Understood."
    assert messages[-1]["content"] == "What was my topic?"


@pytest.mark.asyncio
async def test_persist_exchange_creates_general_conversation_and_messages():
    session = FakeSession()

    await persist_exchange(session, "conversation-1", "What is recursion?", "An answer")

    conversation = next(item for item in session.added if isinstance(item, ChatConversation))
    messages = [item for item in session.added if isinstance(item, ChatMessage)]
    assert conversation.id == "conversation-1"
    assert conversation.title == "What is recursion?"
    assert conversation.chat_type == "general"
    assert [message.role for message in messages] == ["user", "assistant"]
    assert session.commits == 1
