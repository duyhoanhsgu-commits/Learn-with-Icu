import asyncio

from src.agent.research.config import research_settings
from src.agent.research.retrieval import (
    HybridResearchRetriever,
    LexicalResearchRetriever,
    ResearchReranker,
)
from src.agent.research.state import ResearchState
from src.core.logging import logger
from src.rag.retriever import RAGRetriever, retriever

LOCAL_TOP_K_PER_QUESTION = research_settings.vector_candidate_k
_DEFAULT = object()


class LocalResearchRetriever:
    def __init__(
        self,
        rag_retriever: RAGRetriever | None = None,
        lexical_retriever=_DEFAULT,
        reranker: ResearchReranker | None = None,
    ):
        vector = rag_retriever or retriever
        # A custom vector dependency historically meant an isolated unit test.
        # Production construction enables lexical retrieval by default.
        if lexical_retriever is _DEFAULT:
            lexical_retriever = None if rag_retriever is not None else LexicalResearchRetriever()
        self.hybrid = HybridResearchRetriever(
            vector_retriever=vector,
            lexical_retriever=lexical_retriever,
            reranker=reranker,
        )

    @staticmethod
    def queries_for_question(state: ResearchState, question: str) -> list[str]:
        structured = next(
            (item for item in state.research_plan if item.question == question),
            None,
        )
        if structured:
            return state.question_query_map.get(structured.id) or [structured.search_query]
        mapped = [
            query for query, mapped_question in state.query_question_map.items()
            if mapped_question == question
        ]
        return mapped or [question]

    async def run(self, state: ResearchState) -> ResearchState:
        understanding = state.query_understanding
        if (
            not state.space_id
            or not state.research_questions
            or (understanding is not None and not understanding.use_local_sources)
        ):
            return state
        state.progress(
            "research.retrieve_local",
            "Searching uploaded documents",
            current=0,
            total=len(state.research_questions),
        )
        batches = await asyncio.gather(*[
            self.hybrid.retrieve(
                question=question,
                queries=self.queries_for_question(state, question),
                space_id=state.space_id,
                top_k=research_settings.rerank_top_k,
            )
            for question in state.research_questions
        ], return_exceptions=True)

        chunks: dict[str, dict] = {}
        without_ids: list[dict] = []
        for question, batch in zip(state.research_questions, batches):
            if isinstance(batch, Exception):
                logger.warning(f"Local research retrieval failed for {question!r}: {batch}")
                continue
            for context in batch:
                source = {
                    **context,
                    "title": context.get("source", "Uploaded document"),
                    "research_questions": [question],
                    "source_type": "local",
                    "extracted": False,
                    "space_id": state.space_id,
                }
                chunk_id = context.get("chunk_id")
                if chunk_id is None:
                    without_ids.append(source)
                    continue
                current = chunks.get(str(chunk_id))
                if current is None:
                    chunks[str(chunk_id)] = source
                    continue
                if question not in current["research_questions"]:
                    current["research_questions"].append(question)
                candidate_rank = (
                    context.get("relevance_score", 0.0),
                    context.get("score", 0.0),
                )
                current_rank = (
                    current.get("relevance_score", 0.0),
                    current.get("score", 0.0),
                )
                if candidate_rank > current_rank:
                    preserved_questions = current["research_questions"]
                    chunks[str(chunk_id)] = {
                        **source,
                        "research_questions": preserved_questions,
                    }

        state.local_sources = sorted(
            [*chunks.values(), *without_ids],
            key=lambda item: item.get("relevance_score", item.get("score", 0.0)),
            reverse=True,
        )
        state.progress(
            "research.rerank",
            "Ranking local evidence candidates",
            current=len(state.local_sources),
        )
        return state


async def retrieve_local_node(
    state: ResearchState,
    local_retriever: LocalResearchRetriever,
) -> ResearchState:
    return await local_retriever.run(state)
