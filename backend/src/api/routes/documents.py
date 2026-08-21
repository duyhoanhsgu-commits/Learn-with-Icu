import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.storage.postgres import get_db_session, Document, LearningSpace
from src.storage.object_store import object_store
from src.storage.vector_store import vector_store
from src.workers.ingestion_worker import process_document_background
from src.api.schemas import DocumentResponse, DocumentListResponse, DocumentUploadResponse
from src.core.logging import logger

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    space_id: str = Form(...),
    db: AsyncSession = Depends(get_db_session),
):
    """Upload a file (PDF, TXT, MD, JSON) and enqueue async ingestion."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")
    if not await db.get(LearningSpace, space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")

    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    allowed_exts = ["pdf", "txt", "md", "json"]
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{file_ext}'. Allowed formats: {', '.join(allowed_exts)}"
        )

    # 1. Save physical file via ObjectStore
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    saved_path = object_store.save_file(file.file, unique_filename)
    file.file.seek(0, 2)
    file_size = file.file.tell()

    # 2. Record document entry in Postgres DB
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        space_id=space_id,
        filename=file.filename,
        file_path=str(saved_path),
        file_type=file_ext,
        file_size=file_size,
        status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 3. Schedule background ingestion task
    background_tasks.add_task(process_document_background, doc_id, str(saved_path))
    logger.info(f"Uploaded file '{file.filename}' (id={doc_id}), ingestion task queued.")

    return DocumentUploadResponse(
        message="File uploaded successfully. Ingestion process started in background.",
        document=doc,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    space_id: str | None = None,
    db: AsyncSession = Depends(get_db_session),
):
    """List all uploaded documents."""
    count_query = select(func.count()).select_from(Document)
    if space_id:
        count_query = count_query.where(Document.space_id == space_id)
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = select(Document)
    if space_id:
        query = query.where(Document.space_id == space_id)
    query = query.order_by(Document.created_at.desc()).offset(skip).limit(limit)
    res = await db.execute(query)
    docs = res.scalars().all()

    return DocumentListResponse(total=total, documents=list(docs))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get document status and details by ID."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document with ID '{document_id}' not found.")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete document metadata, file from object storage, and vectors from vector store."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document with ID '{document_id}' not found.")

    # Delete vectors from VectorStore
    await vector_store.delete_by_document_id(document_id)

    # Delete physical file from ObjectStore
    filename_on_disk = doc.file_path.split("/")[-1]
    object_store.delete_file(filename_on_disk)

    # Delete database record
    await db.delete(doc)
    await db.commit()

    logger.info(f"Deleted document ID={document_id} and associated resources.")
    return {"message": f"Document '{doc.filename}' deleted successfully.", "document_id": document_id}
