import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres import get_db_session, ChatConversation, ChatMessage
from src.agent import agent_graph
from src.agent.context import (
    CONTEXT_INPUT_TOKEN_BUDGET,
    CONTEXT_WINDOW_TOKEN_LIMIT,
    PersonalContext,
    SpaceNotFoundError,
    personal_context_service,
    space_context_memory,
    context_builder,
)
from src.agent.research import ResearchState, research_graph
from src.agent.router import route_agent
from src.agent.state import AgentState
from src.rag.pipeline import rag_pipeline
from src.api.schemas import (
    ChatQueryRequest,
    ChatQueryResponse,
    ConversationCreate,
    ConversationCompactResponse,
    ConversationDetailResponse,
    ConversationMessageResponse,
    ConversationResponse,
    ContextWindowItem,
    GeneralChatRequest,
)
from src.rag.generator import generator
from src.learner import learner_repository
from src.tutor import tutor_service

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])


def conversation_title(question: str) -> str:
    compact = " ".join(question.split())
    return compact if len(compact) <= 72 else f"{compact[:69].rstrip()}..."


async def load_fixed_context(
    db: AsyncSession,
    space_id: str | None,
) -> str:
    if not space_id:
        return ""
    try:
        return await space_context_memory.get(db, space_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


async def load_personal_context(
    db: AsyncSession,
    space_id: str | None,
    query: str,
) -> PersonalContext:
    try:
        return await personal_context_service.load(db, space_id, query)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


async def load_recent_history(
    db: AsyncSession,
    session_id: str,
    chat_type: str,
    space_id: str | None,
) -> list[dict[str, str]]:
    conversation = await db.get(ChatConversation, session_id)
    if conversation is None:
        return []
    if conversation.chat_type != chat_type or conversation.space_id != space_id:
        raise HTTPException(
            status_code=409,
            detail="Conversation does not belong to this chat type or learning space.",
        )
    query = select(ChatMessage).where(
        ChatMessage.session_id == session_id,
        ChatMessage.excluded_from_context.is_(False),
    )
    if conversation.context_compacted_at:
        query = query.where(ChatMessage.created_at > conversation.context_compacted_at)
    result = await db.execute(
        query
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    history = [
        {"role": message.role, "content": message.content}
        for message in messages
        if message.role in {"user", "assistant"}
    ]
    if conversation.context_summary:
        history.insert(0, {
            "role": "assistant",
            "content": (
                "Summary of the conversation before the current context window:\n\n"
                f"{conversation.context_summary}"
            ),
        })
    return context_builder.fit_recent_messages(history, CONTEXT_INPUT_TOKEN_BUDGET)


async def persist_exchange(
    db: AsyncSession,
    session_id: str,
    question: str,
    answer: str,
    sources=None,
    chat_type: str = "general",
    space_id: str | None = None,
):
    conversation = await db.get(ChatConversation, session_id)
    now = datetime.now(timezone.utc)
    if conversation is None:
        conversation = ChatConversation(
            id=session_id,
            title=conversation_title(question),
            chat_type=chat_type,
            space_id=space_id,
            created_at=now,
            updated_at=now,
        )
        db.add(conversation)
    else:
        if conversation.chat_type != chat_type or conversation.space_id != space_id:
            raise HTTPException(
                status_code=409,
                detail="Conversation does not belong to this chat type or learning space.",
            )
        if conversation.title == "New conversation":
            conversation.title = conversation_title(question)
        conversation.updated_at = now

    db.add(ChatMessage(session_id=session_id, role="user", content=question))
    db.add(ChatMessage(
        session_id=session_id,
        role="assistant",
        content=answer,
        sources={"sources": sources or []},
    ))
    await db.commit()


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    chat_type: str = Query(default="general", pattern="^(general|learning)$"),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.chat_type == chat_type)
        .order_by(ChatConversation.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = ChatConversation(title=payload.title.strip() or "New conversation", chat_type="general")
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = await db.get(ChatConversation, conversation_id)
    if not conversation or conversation.chat_type != "general":
        raise HTTPException(status_code=404, detail="Conversation not found.")
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == conversation_id)
        .order_by(ChatMessage.created_at.asc())
    )
    stored_messages = list(result.scalars().all())
    messages = []
    visible_messages = [
        message
        for message in stored_messages
        if conversation.chat_cleared_at is None
        or message.created_at > conversation.chat_cleared_at
    ]
    for message in visible_messages:
        stored_sources = message.sources or {}
        messages.append(ConversationMessageResponse(
            id=message.id,
            role=message.role,
            content=message.content,
            sources=stored_sources.get("sources", []) if isinstance(stored_sources, dict) else [],
            created_at=message.created_at,
        ))
    summary_content = (
        "Summary of the conversation before the current context window:\n\n"
        f"{conversation.context_summary}"
        if conversation.context_summary else ""
    )
    raw_context_items = [
        *([{"id": "context-summary", "role": "assistant", "content": summary_content, "kind": "summary"}] if summary_content else []),
        *[
            {"id": message.id, "role": message.role, "content": message.content, "kind": "message"}
            for message in stored_messages
            if not message.excluded_from_context
            and message.role in {"user", "assistant"}
            and (
                conversation.context_compacted_at is None
                or message.created_at > conversation.context_compacted_at
            )
        ],
    ]
    active_context = context_builder.fit_recent_messages(raw_context_items, CONTEXT_INPUT_TOKEN_BUDGET)
    active_item_metadata = raw_context_items[-len(active_context):] if active_context else []
    context_items = [
        ContextWindowItem(
            id=metadata["id"],
            role=message["role"],
            content=message["content"],
            token_count=context_builder.count_message_tokens(message),
            kind=metadata["kind"],
        )
        for metadata, message in zip(active_item_metadata, active_context)
    ]

    return ConversationDetailResponse.model_validate({
        "id": conversation.id,
        "title": conversation.title,
        "chat_type": conversation.chat_type,
        "space_id": conversation.space_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": messages,
        "context_token_count": context_builder.count_messages_tokens(active_context),
        "context_token_limit": CONTEXT_WINDOW_TOKEN_LIMIT,
        "context_can_compact": any(
            message.role in {"user", "assistant"}
            and (
                conversation.context_compacted_at is None
                or message.created_at > conversation.context_compacted_at
            )
            for message in stored_messages
            if not message.excluded_from_context
        ),
        "context_items": context_items,
    })


@router.post(
    "/conversations/{conversation_id}/compact",
    response_model=ConversationCompactResponse,
)
async def compact_conversation_context(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = await db.get(ChatConversation, conversation_id)
    if not conversation or conversation.chat_type != "general":
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Use the start of compaction as the boundary so a concurrently-arriving
    # message is never skipped from both the summary and the next window.
    compact_boundary = datetime.now(timezone.utc)
    history = await load_recent_history(
        db,
        conversation_id,
        chat_type="general",
        space_id=conversation.space_id,
    )
    new_message_count = len(history) - (1 if conversation.context_summary else 0)
    if new_message_count <= 0:
        raise HTTPException(status_code=400, detail="There is no new context to summarize.")

    summary = await generator.generate_general_response(
        query=(
            "Compact the conversation context above into a concise working memory. "
            "Preserve the user's goals, preferences, established facts, decisions, "
            "important explanations, unresolved questions, and next steps. Do not add "
            "new information. Return only the structured summary."
        ),
        history=history,
    )
    summary = summary.strip()
    if not summary:
        raise HTTPException(status_code=502, detail="Could not summarize the context.")

    conversation.context_summary = summary
    conversation.context_compacted_at = compact_boundary
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()

    summary_message = {
        "role": "assistant",
        "content": (
            "Summary of the conversation before the current context window:\n\n"
            f"{summary}"
        ),
    }
    return ConversationCompactResponse(
        conversation_id=conversation_id,
        summary=summary,
        context_token_count=context_builder.count_messages_tokens([summary_message]),
        context_token_limit=CONTEXT_WINDOW_TOKEN_LIMIT,
        context_can_compact=False,
        context_items=[ContextWindowItem(
            id="context-summary",
            role="assistant",
            content=summary_message["content"],
            token_count=context_builder.count_message_tokens(summary_message),
            kind="summary",
        )],
    )


@router.delete(
    "/conversations/{conversation_id}/context/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_context_item(
    conversation_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = await db.get(ChatConversation, conversation_id)
    if not conversation or conversation.chat_type != "general":
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if item_id == "context-summary":
        if not conversation.context_summary:
            raise HTTPException(status_code=404, detail="Context item not found.")
        conversation.context_summary = None
    else:
        message = await db.get(ChatMessage, item_id)
        if not message or message.session_id != conversation_id:
            raise HTTPException(status_code=404, detail="Context item not found.")
        message.excluded_from_context = True

    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()


@router.post(
    "/conversations/{conversation_id}/clear",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def clear_visible_chat(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = await db.get(ChatConversation, conversation_id)
    if not conversation or conversation.chat_type != "general":
        raise HTTPException(status_code=404, detail="Conversation not found.")

    now = datetime.now(timezone.utc)
    conversation.chat_cleared_at = now
    conversation.updated_at = now
    await db.commit()


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    conversation = await db.get(ChatConversation, conversation_id)
    if not conversation or conversation.chat_type != "general":
        raise HTTPException(status_code=404, detail="Conversation not found.")
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == conversation_id))
    await db.delete(conversation)
    await db.commit()


@router.post("/general", response_model=ChatQueryResponse)
async def general_chat(
    request: GeneralChatRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """General-purpose LLM chat without document retrieval."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    personal_context = await load_personal_context(
        db,
        request.space_id,
        request.question,
    )
    history = await load_recent_history(
        db,
        request.session_id,
        chat_type="general",
        space_id=request.space_id,
    )
    state = await agent_graph.run(AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
        requested_route="general_chat",
        history=history,
        fixed_context=personal_context.fixed_context,
        memory_context=personal_context.memory_context,
    ))
    await persist_exchange(
        db,
        request.session_id,
        request.question,
        state.answer,
        chat_type="general",
        space_id=request.space_id,
    )
    return ChatQueryResponse(
        session_id=request.session_id,
        question=request.question,
        answer=state.answer,
        sources=state.sources,
        tutor_action=state.tutor_action,
        current_concept_id=state.current_concept_id,
        tutor_reason=state.tutor_reason,
    )


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Q&A query endpoint over ingested documents with RAG pipeline."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    personal_context = await load_personal_context(
        db,
        request.space_id,
        request.question,
    )
    history = await load_recent_history(
        db,
        request.session_id,
        chat_type="learning",
        space_id=request.space_id,
    )

    # The graph selects regular RAG or the summarization specialist.
    state = await agent_graph.run(AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        image_data_url=request.image_data_url,
        history=history,
        db_session=db,
        tutor_pending=(
            await learner_repository.pending_assessment(
                db, request.session_id, request.space_id
            ) is not None
        ),
        fixed_context=personal_context.fixed_context,
        memory_context=personal_context.memory_context,
    ))

    # 2. Persist chat message history to Database
    await persist_exchange(
        db,
        request.session_id,
        request.question,
        state.answer,
        state.sources,
        chat_type="learning",
        space_id=request.space_id,
    )

    return ChatQueryResponse(
        session_id=request.session_id,
        question=state.query,
        answer=state.answer,
        sources=state.sources,
        tutor_action=state.tutor_action,
        current_concept_id=state.current_concept_id,
        tutor_reason=state.tutor_reason,
    )


@router.post("/stream")
async def chat_stream(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Streaming Q&A endpoint over ingested documents."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    personal_context = await load_personal_context(
        db,
        request.space_id,
        request.question,
    )
    history = await load_recent_history(
        db,
        request.session_id,
        chat_type="learning",
        space_id=request.space_id,
    )

    pending_assessment = await learner_repository.pending_assessment(
        db, request.session_id, request.space_id
    )
    route = route_agent(AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
        history=history,
        fixed_context=personal_context.fixed_context,
        memory_context=personal_context.memory_context,
        tutor_pending=pending_assessment is not None,
    ))

    async def event_generator():
        if route == "tutor":
            result = await tutor_service.respond(
                db=db,
                learner_id=request.session_id,
                space_id=request.space_id,
                message=request.question,
                history=history,
                top_k=request.top_k,
                fixed_context=personal_context.fixed_context,
                memory_context=personal_context.memory_context,
            )
            yield result.answer
            return
        if route == "research":
            queue: asyncio.Queue = asyncio.Queue()
            research_state = ResearchState(
                query=request.question,
                space_id=request.space_id,
                fixed_context=personal_context.fixed_context,
                memory_context=personal_context.memory_context,
                history=history,
                progress_callback=queue.put_nowait,
            )
            task = asyncio.create_task(research_graph.run(research_state))
            while not task.done() or not queue.empty():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.1)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    continue
            try:
                await task
            except Exception:
                error_event = {
                    "type": "research.error",
                    "message": "Research could not be completed.",
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
            return
        async for token in rag_pipeline.answer_question_stream(
            query=request.question,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            filter_dict={"space_id": request.space_id},
            fixed_context=personal_context.fixed_context,
            memory_context=personal_context.memory_context,
            history=history,
        ):
            yield token

    return StreamingResponse(event_generator(), media_type="text/event-stream")
