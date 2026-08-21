from typing import List, Dict, Any, Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from src.core.config import settings
from src.core.logging import logger


class VectorStore:
    """Vector Store service supporting Qdrant and pgvector interface."""

    def __init__(self):
        self.store_type = settings.VECTOR_STORE_TYPE
        if self.store_type == "qdrant":
            self.client = AsyncQdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
            )
            self.collection_name = settings.QDRANT_COLLECTION_NAME
        else:
            self.client = None

    async def ensure_collection(self, vector_size: int = settings.EMBEDDING_DIMENSION) -> None:
        """Ensure vector store collection/table exists."""
        if self.store_type == "qdrant":
            try:
                collections = await self.client.get_collections()
                exists = any(c.name == self.collection_name for c in collections.collections)
                if not exists:
                    await self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(
                            size=vector_size,
                            distance=Distance.COSINE,
                        ),
                    )
                    logger.info(f"Created Qdrant collection: {self.collection_name}")
            except Exception as e:
                logger.error(f"Error ensuring Qdrant collection: {e}")

    async def upsert_vectors(
        self,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        """Upsert vectors into the vector store."""
        await self.ensure_collection()
        import uuid

        point_ids = ids if ids else [str(uuid.uuid4()) for _ in range(len(vectors))]

        if self.store_type == "qdrant":
            points = [
                PointStruct(id=pid, vector=vec, payload=pay)
                for pid, vec, pay in zip(point_ids, vectors, payloads)
            ]
            await self.client.upsert(
                collection_name=self.collection_name,
                points=points,
            )
            return point_ids
        else:
            # Fallback/mock implementation for in-memory or pgvector placeholder
            logger.info(f"Upserted {len(vectors)} vectors to vector store ({self.store_type})")
            return point_ids

    async def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        score_threshold: float = 0.0,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search similar vectors."""
        if self.store_type == "qdrant":
            try:
                query_filter = None
                space_id = (filter_dict or {}).get("space_id")
                if space_id:
                    query_filter = Filter(
                        must=[FieldCondition(key="space_id", match=MatchValue(value=space_id))]
                    )
                results = await self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    limit=top_k,
                    score_threshold=score_threshold if score_threshold > 0 else None,
                    query_filter=query_filter,
                )
                return [
                    {
                        "id": str(res.id),
                        "score": res.score,
                        "payload": res.payload,
                    }
                    for res in results
                ]
            except Exception as e:
                logger.error(f"Vector search failed: {e}")
                return []
        return []

    async def delete_by_document_id(self, document_id: str) -> bool:
        """Delete vectors belonging to a document."""
        if self.store_type == "qdrant":
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            try:
                await self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=Filter(
                        must=[
                            FieldCondition(
                                key="document_id",
                                match=MatchValue(value=document_id),
                            )
                        ]
                    ),
                )
                return True
            except Exception as e:
                logger.error(f"Error deleting vectors for document {document_id}: {e}")
                return False
        return True

    async def assign_document_to_space(self, document_id: str, space_id: str) -> bool:
        """Backfill the space payload on vectors created before spaces existed."""
        if self.store_type == "qdrant":
            try:
                await self.client.set_payload(
                    collection_name=self.collection_name,
                    payload={"space_id": space_id},
                    points=Filter(
                        must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
                    ),
                )
                return True
            except Exception as e:
                logger.error(f"Error assigning document {document_id} vectors to space {space_id}: {e}")
                return False
        return True


vector_store = VectorStore()
