from src.agent.state import AgentState
from src.rag.pipeline import rag_pipeline


async def rag_node(state: AgentState) -> AgentState:
    result = await rag_pipeline.answer_question(
        query=state.query,
        top_k=state.top_k,
        score_threshold=state.score_threshold,
        filter_dict={"space_id": state.space_id},
    )
    state.answer = result["answer"]
    state.sources = result["sources"]
    return state
