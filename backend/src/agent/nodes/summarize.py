from src.agent.state import AgentState
from src.rag.generator import generator
from src.rag.retriever import retriever


async def summarize_node(state: AgentState) -> AgentState:
    contexts = await retriever.retrieve(
        query=state.query,
        top_k=max(state.top_k, 12),
        score_threshold=state.score_threshold,
        filter_dict={"space_id": state.space_id},
    )
    state.answer = await generator.generate_response(
        query=state.query,
        contexts=contexts,
        system_prompt=(
            "You summarize learning materials faithfully. Organize the answer into "
            "the main ideas, supporting details, and key takeaways. Use only the "
            "provided document context and clearly state any coverage limitations."
        ),
        image_data_url=state.image_data_url,
    )
    state.sources = contexts
    return state
