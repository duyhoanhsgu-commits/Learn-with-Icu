import asyncio

from src.agent.research.state import ResearchState
from src.core.logging import logger
from src.rag.retriever import RAGRetriever, retriever

LOCAL_TOP_K_PER_QUESTION = 3


class LocalResearchRetriever:
    def __init__(self, rag_retriever: RAGRetriever | None = None):
        self.retriever = rag_retriever or retriever

    async def run(self, state: ResearchState) -> ResearchState:
        if not state.space_id or not state.research_questions:
            return state
        state.progress(
            "research.retrieve_local",
            "Searching uploaded documents",
            current=0,
            total=len(state.research_questions),
        )
        filter_dict = {"space_id": state.space_id}
        batches = await asyncio.gather(*[
            self.retriever.retrieve(
                query=question,
                top_k=LOCAL_TOP_K_PER_QUESTION,
                score_threshold=0.0,
                filter_dict=filter_dict,
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
                if context.get("score", 0.0) > current.get("score", 0.0):
                    preserved_questions = current["research_questions"]
                    chunks[str(chunk_id)] = {**source, "research_questions": preserved_questions}

        state.local_sources = sorted(
            [*chunks.values(), *without_ids],
            key=lambda item: item.get("score", 0.0),
            reverse=True,
        )
        return state


async def retrieve_local_node(
    state: ResearchState,
    local_retriever: LocalResearchRetriever,
) -> ResearchState:
    return await local_retriever.run(state)
