import math
from typing import List
from openai import AsyncOpenAI
from src.core.config import settings
from src.core.logging import logger


class EmbeddingService:
    """Service to handle vector embedding generation."""

    def __init__(self):
        self.model_name = settings.EMBEDDING_MODEL_NAME
        self.dimension = settings.EMBEDDING_DIMENSION
        self.api_key = settings.OPENAI_API_KEY
        self._client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a list of strings."""
        if not texts:
            return []

        if self._client:
            try:
                response = await self._client.embeddings.create(
                    model=self.model_name,
                    input=texts
                )
                return [item.embedding for item in response.data]
            except Exception as e:
                logger.warning(f"OpenAI embedding error ({e}), falling back to deterministic mock embedding.")

        # Deterministic fallback embedding generation for dev/testing when API key is missing
        return [self._generate_fallback_embedding(text) for text in texts]

    async def get_query_embedding(self, query: str) -> List[float]:
        """Generate embedding vector for a single query."""
        results = await self.get_embeddings([query])
        return results[0] if results else [0.0] * self.dimension

    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Generate normalized mock embedding vector based on hash of text."""
        vec = []
        seed = sum(ord(c) for c in text)
        for i in range(self.dimension):
            val = math.sin(seed + i * 0.1)
            vec.append(val)
        
        # Normalize vector to unit length
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec


embedding_service = EmbeddingService()
