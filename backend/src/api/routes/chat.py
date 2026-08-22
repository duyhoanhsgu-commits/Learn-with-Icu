from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres import get_db_session, ChatMessage, LearningSpace
from src.agent import agent_graph
from src.agent.state import AgentState
from src.rag.pipeline import rag_pipeline
from src.api.schemas import ChatQueryRequest, ChatQueryResponse, GeneralChatRequest

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])


async def persist_exchange(db, session_id: str, question: str, answer: str, sources=None):
    db.add(ChatMessage(session_id=session_id, role="user", content=question))
    db.add(ChatMessage(
        session_id=session_id,
        role="assistant",
        content=answer,
        sources={"sources": sources or []},
    ))
    await db.commit()


@router.post("/general", response_model=ChatQueryResponse)
async def general_chat(
    request: GeneralChatRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """General-purpose LLM chat without document retrieval."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    state = await agent_graph.run(AgentState(
        query=request.question,
        session_id=request.session_id,
        requested_route="general_chat",
    ))
    await persist_exchange(db, request.session_id, request.question, state.answer)
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
    ))

    # 2. Persist chat message history to Database
    await persist_exchange(db, request.session_id, request.question, state.answer, state.sources)

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

    async def event_generator():
        async for token in rag_pipeline.answer_question_stream(
            query=request.question,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            filter_dict={"space_id": request.space_id},
        ):
            yield token

    return StreamingResponse(event_generator(), media_type="text/event-stream")
