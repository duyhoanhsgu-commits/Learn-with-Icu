from pathlib import Path
from src.storage.postgres import AsyncSessionLocal
from src.ingestion.pipeline import ingestion_pipeline
from src.core.logging import logger


async def process_document_background(document_id: str, file_path_str: str) -> None:
    """
    Background worker task to handle document ingestion asynchronously.
    Can be dispatched by FastAPI BackgroundTasks, Celery, or asyncio task queue.
    """
    logger.info(f"Background worker picked up job for document_id={document_id}")
    file_path = Path(file_path_str)

    async with AsyncSessionLocal() as session:
        try:
            res = await ingestion_pipeline.process_document(
                document_id=document_id,
                file_path=file_path,
                db_session=session,
            )
            logger.info(f"Background worker completed document_id={document_id}: {res}")
        except Exception as e:
            logger.error(f"Background worker failed processing document_id={document_id}: {e}")
