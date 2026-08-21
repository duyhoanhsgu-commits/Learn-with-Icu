import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import LearningSpaceCreate, LearningSpaceResponse
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
