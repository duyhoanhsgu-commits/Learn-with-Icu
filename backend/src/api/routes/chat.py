import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres import get_db_session, ChatConversation, ChatMessage, LearningSpace
from src.agent import agent_graph
from src.agent.research import ResearchState, research_graph
from src.agent.router import route_agent
from src.agent.state import AgentState
from src.rag.pipeline import rag_pipeline
from src.api.schemas import (
    ChatQueryRequest,
    ChatQueryResponse,
    ConversationCreate,
    ConversationDetailResponse,
    ConversationMessageResponse,
    ConversationResponse,
    GeneralChatRequest,
)

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])


def conversation_title(question: str) -> str:
    compact = " ".join(question.split())
    return compact if len(compact) <= 72 else f"{compact[:69].rstrip()}..."


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
    messages = []
    for message in result.scalars().all():
        stored_sources = message.sources or {}
        messages.append(ConversationMessageResponse(
            id=message.id,
            role=message.role,
            content=message.content,
            sources=stored_sources.get("sources", []) if isinstance(stored_sources, dict) else [],
            created_at=message.created_at,
        ))
    return ConversationDetailResponse.model_validate({
        "id": conversation.id,
        "title": conversation.title,
        "chat_type": conversation.chat_type,
        "space_id": conversation.space_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": messages,
    })


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

    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == request.session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    previous_messages = list(reversed(history_result.scalars().all()))
    state = await agent_graph.run(AgentState(
        query=request.question,
        session_id=request.session_id,
        history=[{"role": message.role, "content": message.content} for message in previous_messages],
    ))
    await persist_exchange(db, request.session_id, request.question, state.answer, chat_type="general")
    return ChatQueryResponse(
        session_id=request.session_id,
        question=request.question,
        answer=state.answer,
        sources=state.sources,
    )


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Q&A query endpoint over ingested documents with RAG pipeline."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if not await db.get(LearningSpace, request.space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")

    # The graph selects regular RAG or the summarization specialist.
    state = await agent_graph.run(AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        image_data_url=request.image_data_url,
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
    )


@router.post("/stream")
async def chat_stream(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Streaming Q&A endpoint over ingested documents."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if not await db.get(LearningSpace, request.space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")

    route = route_agent(AgentState(
        query=request.question,
        session_id=request.session_id,
        space_id=request.space_id,
    ))

    async def event_generator():
        if route == "research":
            queue: asyncio.Queue = asyncio.Queue()
            research_state = ResearchState(
                query=request.question,
                space_id=request.space_id,
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
        ):
            yield token

    return StreamingResponse(event_generator(), media_type="text/event-stream")
