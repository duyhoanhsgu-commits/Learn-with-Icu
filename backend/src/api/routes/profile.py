from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.agent.context import (
    LongTermMemoryNotFoundError,
    global_long_term_memory_store,
)
from src.api.schemas import GlobalLongTermMemoryResponse, LongTermMemoryPayload
from src.storage.postgres import GlobalLongTermMemory, get_db_session

router = APIRouter(prefix="/profile", tags=["Personalization"])


@router.get("/memories", response_model=list[GlobalLongTermMemoryResponse])
async def list_global_memories(db: AsyncSession = Depends(get_db_session)):
    return await global_long_term_memory_store.list(db)


@router.post(
    "/memories",
    response_model=GlobalLongTermMemoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_global_memory(
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    return await global_long_term_memory_store.create(db, **payload.model_dump())


@router.put(
    "/memories/{memory_id}",
    response_model=GlobalLongTermMemoryResponse,
)
async def update_global_memory(
    memory_id: str,
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await global_long_term_memory_store.update(
            db,
            memory_id,
            **payload.model_dump(),
        )
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Global memory not found.") from exc


@router.delete("/memories/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_global_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        await global_long_term_memory_store.delete(db, memory_id)
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Global memory not found.") from exc


@router.delete("/memories", status_code=status.HTTP_204_NO_CONTENT)
async def clear_global_memories(db: AsyncSession = Depends(get_db_session)):
    await db.execute(delete(GlobalLongTermMemory))
    await db.commit()
