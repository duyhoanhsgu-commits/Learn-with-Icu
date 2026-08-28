from src.agent.nodes.rag import rag_node
from src.agent.state import AgentState
from src.tutor import tutor_service


async def tutor_node(state: AgentState) -> AgentState:
    if state.db_session is None or not state.space_id:
        return await rag_node(state)
    result = await tutor_service.respond(
        db=state.db_session,
        learner_id=state.session_id,
        space_id=state.space_id,
        message=state.query,
        history=state.history,
        top_k=state.top_k,
        fixed_context=state.fixed_context,
        memory_context=state.memory_context,
    )
    state.answer = result.answer
    state.sources = result.sources
    state.current_concept_id = result.concept_id
    state.tutor_action = result.action.value
    state.tutor_reason = result.reason
    return state
