import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agent.context import (
    FixedContextTooLongError,
    LongTermMemoryNotFoundError,
    SpaceNotFoundError,
    long_term_memory_store,
    space_context_memory,
)
from src.api.schemas import (
    LearningSpaceCreate,
    LearningSpaceResponse,
    LongTermMemoryPayload,
    LongTermMemoryResponse,
    SpaceContextResponse,
    SpaceContextUpdate,
    SpaceContextUpdateResponse,
)
from src.storage.object_store import object_store
from src.storage.postgres import Document, LearningSpace, get_db_session
from src.storage.vector_store import vector_store

router = APIRouter(prefix="/spaces", tags=["Learning Spaces"])


@router.get("", response_model=list[LearningSpaceResponse])
async def list_spaces(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(LearningSpace).order_by(LearningSpace.created_at.asc()))
    return list(result.scalars().all())


@router.post("", response_model=LearningSpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(payload: LearningSpaceCreate, db: AsyncSession = Depends(get_db_session)):
    space = LearningSpace(id=str(uuid.uuid4()), name=payload.name.strip(), color=payload.color)
    db.add(space)
    await db.commit()
    await db.refresh(space)
    return space


@router.get("/{space_id}/context", response_model=SpaceContextResponse)
async def get_space_context(
    space_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        fixed_context = await space_context_memory.get(db, space_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    return SpaceContextResponse(space_id=space_id, fixed_context=fixed_context)


@router.put("/{space_id}/context", response_model=SpaceContextUpdateResponse)
async def update_space_context(
    space_id: str,
    payload: SpaceContextUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        fixed_context = await space_context_memory.update(
            db,
            space_id,
            payload.fixed_context,
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except FixedContextTooLongError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SpaceContextUpdateResponse(
        space_id=space_id,
        fixed_context=fixed_context,
        updated=True,
    )


@router.get(
    "/{space_id}/memories",
    response_model=list[LongTermMemoryResponse],
)
async def list_space_memories(
    space_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.list(db, space_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


@router.post(
    "/{space_id}/memories",
    response_model=LongTermMemoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_space_memory(
    space_id: str,
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.create(
            db,
            space_id,
            **payload.model_dump(),
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


@router.put(
    "/{space_id}/memories/{memory_id}",
    response_model=LongTermMemoryResponse,
)
async def update_space_memory(
    space_id: str,
    memory_id: str,
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.update(
            db,
            space_id,
            memory_id,
            **payload.model_dump(),
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Memory not found in this space.") from exc


@router.delete(
    "/{space_id}/memories/{memory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_space_memory(
    space_id: str,
    memory_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        await long_term_memory_store.delete(db, space_id, memory_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Memory not found in this space.") from exc


@router.delete("/{space_id}")
async def delete_space(space_id: str, db: AsyncSession = Depends(get_db_session)):
    space = await db.get(LearningSpace, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Learning space not found.")
    result = await db.execute(select(Document).where(Document.space_id == space_id))
    for document in result.scalars().all():
        await vector_store.delete_by_document_id(document.id)
        object_store.delete_file(document.file_path.split("/")[-1])
        await db.delete(document)
    await db.flush()
    await db.delete(space)
    await db.commit()
    return {"message": f"Learning space '{space.name}' deleted.", "space_id": space_id}
