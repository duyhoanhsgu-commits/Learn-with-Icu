from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres import get_db_session, ChatMessage
from src.rag.pipeline import rag_pipeline
from src.api.schemas import ChatQueryRequest, ChatQueryResponse
from src.core.logging import logger

router = APIRouter(prefix="/chat", tags=["Chat & Q&A"])


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Q&A query endpoint over ingested documents with RAG pipeline."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # 1. Run RAG Pipeline
    result = await rag_pipeline.answer_question(
        query=request.question,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
    )

    # 2. Persist chat message history to Database
    user_msg = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.question,
    )
    assistant_msg = ChatMessage(
        session_id=request.session_id,
        role="assistant",
        content=result["answer"],
        sources={"sources": result["sources"]},
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()

    return ChatQueryResponse(
        session_id=request.session_id,
        question=result["query"],
        answer=result["answer"],
        sources=result["sources"],
    )


@router.post("/stream")
async def chat_stream(
    request: ChatQueryRequest,
):
    """Streaming Q&A endpoint over ingested documents."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    async def event_generator():
        async for token in rag_pipeline.answer_question_stream(
            query=request.question,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
        ):
            yield token

    return StreamingResponse(event_generator(), media_type="text/event-stream")
