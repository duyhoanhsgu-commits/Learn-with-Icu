import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator

from src.rag.retriever import RAGRetriever, retriever
from src.rag.generator import RAGGenerator, generator
from src.rag.query_planner import QueryPlan, QueryPlanner, query_planner
from src.core.logging import logger

MULTI_QUERY_TOP_K = 3


class RAGPipeline:
    """Combines Retriever and Generator into complete RAG Q&A pipeline."""

    def __init__(
        self,
        custom_retriever: Optional[RAGRetriever] = None,
        custom_generator: Optional[RAGGenerator] = None,
        custom_query_planner: Optional[QueryPlanner] = None,
    ):
        self.retriever = custom_retriever or retriever
        self.generator = custom_generator or generator
        self.query_planner = custom_query_planner or query_planner

    @staticmethod
    def _merge_contexts(results: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Deduplicate chunk IDs, keep their best score, then sort descending."""
        contexts_by_chunk: Dict[str, Dict[str, Any]] = {}
        contexts_without_id: List[Dict[str, Any]] = []

        for contexts in results:
            for context in contexts:
                chunk_id = context.get("chunk_id")
                if chunk_id is None:
                    contexts_without_id.append(context)
                    continue

                current = contexts_by_chunk.get(chunk_id)
                if current is None or context.get("score", 0.0) > current.get("score", 0.0):
                    contexts_by_chunk[chunk_id] = context

        merged = [*contexts_by_chunk.values(), *contexts_without_id]
        return sorted(merged, key=lambda context: context.get("score", 0.0), reverse=True)

    async def _retrieve_contexts(
        self,
        query: str,
        top_k: int,
        score_threshold: float,
        filter_dict: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Plan retrieval and execute either one search or parallel sub-searches."""
        try:
            plan = await self.query_planner.plan(query)
        except Exception as exc:
            logger.warning(f"Query planner raised unexpectedly; using original query: {exc}")
            plan = QueryPlan(type="simple", queries=[query])

        logger.info(f"Query plan type={plan.type}, retrieval_queries={len(plan.queries)}")
        if plan.type == "simple":
            return await self.retriever.retrieve(
                query=query,
                top_k=top_k,
                score_threshold=score_threshold,
                filter_dict=filter_dict,
            )

        per_query_top_k = min(top_k, MULTI_QUERY_TOP_K)
        results = await asyncio.gather(
            *[
                self.retriever.retrieve(
                    query=sub_query,
                    top_k=per_query_top_k,
                    score_threshold=score_threshold,
                    filter_dict=filter_dict,
                )
                for sub_query in plan.queries
            ]
        )
        return self._merge_contexts(results)

    async def answer_question(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
        filter_dict: Optional[Dict[str, Any]] = None,
        image_data_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process query through RAG pipeline: Retrieve -> Generate -> Return answer + sources."""
        logger.info(f"Executing RAG pipeline for query: '{query}'")

        # 1. Plan and retrieve relevant contexts
        contexts = await self._retrieve_contexts(
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            filter_dict=filter_dict,
        )

        # 2. Generate LLM answer
        answer = await self.generator.generate_response(
            query=query,
            contexts=contexts,
            image_data_url=image_data_url,
        )

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
        contexts = await self._retrieve_contexts(
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            filter_dict=filter_dict,
        )

        async for chunk in self.generator.generate_stream(query=query, contexts=contexts):
            yield chunk


rag_pipeline = RAGPipeline()
