from pathlib import Path
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from src.ingestion.parser import DocumentParser
from src.ingestion.chunker import TextChunker
from src.ingestion.metadata import MetadataExtractor
from src.embeddings.service import embedding_service
from src.storage.vector_store import vector_store
from src.storage.postgres import Document, DocumentChunk
from src.core.logging import logger


class IngestionPipeline:
    """Orchestrates parsing, chunking, embedding, and storing document data."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.parser = DocumentParser()
        self.chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.metadata_extractor = MetadataExtractor()

    async def process_document(
        self,
        document_id: str,
        file_path: Path,
        db_session: AsyncSession,
    ) -> Dict[str, Any]:
        """Execute full ingestion pipeline for a document."""
        logger.info(f"Starting ingestion pipeline for document_id={document_id}, file={file_path}")

        # 1. Fetch DB record
        doc_record = await db_session.get(Document, document_id)
        if not doc_record:
            raise ValueError(f"Document record with id {document_id} not found in database.")

        doc_record.status = "processing"
        await db_session.commit()

        try:
            # 2. Parse file content
            text_content, parsed_meta = self.parser.parse_file(file_path)
            doc_metadata = self.metadata_extractor.extract_metadata(file_path, extra_info=parsed_meta)

            # 3. Chunk text
            raw_chunks = self.chunker.split_text(text_content)
            if not raw_chunks:
                logger.warning(f"No text content extracted from file: {file_path.name}")
                raw_chunks = [f"[File: {file_path.name}]"]

            chunk_payloads = self.chunker.create_chunk_payloads(
                raw_chunks,
                base_metadata={**doc_metadata, "document_id": document_id, "space_id": doc_record.space_id},
            )

            # 4. Generate embeddings
            texts_to_embed = [p["text"] for p in chunk_payloads]
            embeddings = await embedding_service.get_embeddings(texts_to_embed)

            # 5. Store vectors in VectorStore
            vector_ids = await vector_store.upsert_vectors(
                vectors=embeddings,
                payloads=chunk_payloads,
            )

            # 6. Save Chunk metadata to PostgreSQL DB
            db_chunks: List[DocumentChunk] = []
            for idx, (payload, vid) in enumerate(zip(chunk_payloads, vector_ids)):
                db_chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=idx,
                    content=payload["text"],
                    vector_id=vid,
                    meta_info=payload,
                )
                db_chunks.append(db_chunk)

            db_session.add_all(db_chunks)

            # 7. Update Document status
            doc_record.status = "completed"
            doc_record.chunk_count = len(raw_chunks)
            doc_record.meta_info = doc_metadata
            await db_session.commit()

            logger.info(f"Completed ingestion for document_id={document_id} with {len(raw_chunks)} chunks.")
            return {
                "document_id": document_id,
                "status": "completed",
                "chunk_count": len(raw_chunks),
            }

        except Exception as e:
            logger.error(f"Error during ingestion pipeline execution for document_id={document_id}: {e}")
            doc_record.status = "failed"
            doc_record.meta_info = {"error": str(e)}
            await db_session.commit()
            raise e


ingestion_pipeline = IngestionPipeline()
