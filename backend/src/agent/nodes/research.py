from src.agent.research import ResearchState, research_graph
from src.agent.state import AgentState


async def research_node(state: AgentState) -> AgentState:
    result = await research_graph.run(ResearchState(
        query=state.query,
        space_id=state.space_id,
        fixed_context=state.fixed_context,
        memory_context=state.memory_context,
        history=state.history,
    ))
    state.answer = result.report or "Không thu thập được đủ evidence để tạo báo cáo."
    state.sources = result.sources
    state.progress_events = result.progress_events
    return state
