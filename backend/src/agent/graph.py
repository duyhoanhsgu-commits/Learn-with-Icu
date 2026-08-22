from collections.abc import Awaitable, Callable

from src.agent.nodes import general_chat_node, rag_node, summarize_node
from src.agent.router import route_agent
from src.agent.state import AgentRoute, AgentState

AgentNode = Callable[[AgentState], Awaitable[AgentState]]


class AgentGraph:
    """Small async routing graph for ICU chat capabilities."""

    def __init__(self) -> None:
        self.nodes: dict[AgentRoute, AgentNode] = {
            "general_chat": general_chat_node,
            "rag": rag_node,
            "summarize": summarize_node,
        }

    async def run(self, state: AgentState) -> AgentState:
        state.route = route_agent(state)
        return await self.nodes[state.route](state)


agent_graph = AgentGraph()
