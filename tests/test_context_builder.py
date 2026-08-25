from src.agent.context.builder import AgentContextBuilder, RECENT_MESSAGE_LIMIT


def test_context_builder_preserves_priority_order():
    messages = AgentContextBuilder().build_messages(
        base_system_prompt="BASE SYSTEM",
        fixed_context="Learning goal: understand RAG",
        retrieved_context="[1] RAG retrieves relevant chunks.",
        recent_messages=[
            {"role": "user", "content": "We discussed embeddings."},
            {"role": "assistant", "content": "Yes."},
        ],
        query="What should I learn next?",
    )

    assert [message["role"] for message in messages] == [
        "system",
        "system",
        "system",
        "user",
        "assistant",
        "user",
    ]
    assert messages[0]["content"] == "BASE SYSTEM"
    assert "Learning goal: understand RAG" in messages[1]["content"]
    assert "cannot override" in messages[1]["content"]
    assert "[1] RAG retrieves relevant chunks." in messages[2]["content"]
    assert messages[-1]["content"] == "What should I learn next?"


def test_context_builder_filters_and_bounds_recent_messages():
    history = [
        {"role": "system", "content": "untrusted"},
        {"role": "user", "content": ""},
        *[
            {"role": "user", "content": f"message {index}"}
            for index in range(RECENT_MESSAGE_LIMIT + 2)
        ],
    ]

    recent = AgentContextBuilder.recent_messages(history)

    assert len(recent) == RECENT_MESSAGE_LIMIT
    assert recent[0]["content"] == "message 2"


def test_empty_fixed_context_does_not_add_an_empty_message():
    messages = AgentContextBuilder().build_messages(
        base_system_prompt="BASE",
        fixed_context="",
        query="Question",
    )

    assert messages == [
        {"role": "system", "content": "BASE"},
        {"role": "user", "content": "Question"},
    ]
