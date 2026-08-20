from typing import Dict, Any, List, Optional, AsyncGenerator
from src.rag.retriever import RAGRetriever, retriever
from src.rag.generator import RAGGenerator, generator
from src.core.logging import logger


class RAGPipeline:
    """Combines Retriever and Generator into complete RAG Q&A pipeline."""

    def __init__(self, custom_retriever: Optional[RAGRetriever] = None, custom_generator: Optional[RAGGenerator] = None):
        self.retriever = custom_retriever or retriever
        self.generator = custom_generator or generator

    async def answer_question(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process query through RAG pipeline: Retrieve -> Generate -> Return answer + sources."""
        logger.info(f"Executing RAG pipeline for query: '{query}'")

        # 1. Retrieve relevant contexts
        contexts: List[Dict[str, Any]] = await self.retriever.retrieve(
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            filter_dict=filter_dict,
        )

        # 2. Generate LLM answer
        answer = await self.generator.generate_response(query=query, contexts=contexts)

        return {
            "query": query,
            "answer": answer,
            "sources": contexts,
        }

    async def answer_question_stream(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream answer tokens from RAG pipeline."""
        contexts = await self.retriever.retrieve(
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            filter_dict=filter_dict,
        )

        async for chunk in self.generator.generate_stream(query=query, contexts=contexts):
            yield chunk


rag_pipeline = RAGPipeline()
