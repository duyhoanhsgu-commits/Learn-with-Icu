from src.agent.state import AgentState
from src.rag.generator import generator


async def general_chat_node(state: AgentState) -> AgentState:
    state.answer = await generator.generate_general_response(state.query, history=state.history)
    state.sources = []
    return state
