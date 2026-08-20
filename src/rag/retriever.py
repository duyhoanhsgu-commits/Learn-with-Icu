from typing import List, Dict, Any, Optional
from src.embeddings.service import embedding_service
from src.storage.vector_store import vector_store
from src.core.logging import logger


class RAGRetriever:
    """Retrieves relevant document chunks from VectorStore using vector similarity."""

    def __init__(self, top_k: int = 5, score_threshold: float = 0.0):
        self.top_k = top_k
        self.score_threshold = score_threshold

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        score_threshold: Optional[float] = None,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant context chunks for a query string."""
        k = top_k if top_k is not None else self.top_k
        threshold = score_threshold if score_threshold is not None else self.score_threshold

        logger.info(f"Retrieving context for query: '{query}' (top_k={k})")
        query_vector = await embedding_service.get_query_embedding(query)

        search_results = await vector_store.search(
            query_vector=query_vector,
            top_k=k,
            score_threshold=threshold,
            filter_dict=filter_dict,
        )

        retrieved_items = []
        for item in search_results:
            payload = item.get("payload", {})
            retrieved_items.append({
                "chunk_id": item.get("id"),
                "score": item.get("score", 0.0),
                "text": payload.get("text", ""),
                "source": payload.get("source", "unknown"),
                "document_id": payload.get("document_id"),
                "chunk_index": payload.get("chunk_index"),
            })

        logger.info(f"Retrieved {len(retrieved_items)} relevant context chunks.")
        return retrieved_items


retriever = RAGRetriever()
