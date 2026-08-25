import asyncio

from src.agent.state import AgentState
from src.agent.tools import fetch_url, search_results
from src.rag.generator import generator


async def web_research_node(state: AgentState) -> AgentState:
    results = await asyncio.to_thread(search_results, state.query, 5)
    if not results:
        state.answer = "Không tìm thấy nguồn web phù hợp để trả lời câu hỏi này."
        state.sources = []
        return state

    fetched = await asyncio.gather(
        *(asyncio.to_thread(fetch_url, result["url"]) for result in results[:3]),
        return_exceptions=True,
    )
    contexts = []
    for search_result, page in zip(results[:3], fetched):
        if isinstance(page, Exception):
            continue
        contexts.append({
            "score": 0.0,
            "source": page["title"] or search_result["title"],
            "url": page["url"],
            "text": page["text"],
        })

    if not contexts:
        state.answer = "Tìm thấy kết quả nhưng không thể đọc nội dung các trang nguồn."
        state.sources = []
        return state

    state.answer = await generator.generate_response(
        query=state.query,
        contexts=contexts,
        system_prompt=(
            "You are a web research assistant. Synthesize the answer from the supplied "
            "web pages, reconcile disagreements, distinguish facts from inference, and "
            "cite sources inline using their titles. Do not claim facts absent from them."
        ),
        fixed_context=state.fixed_context,
        memory_context=state.memory_context,
        history=state.history,
    )
    state.sources = contexts
    return state
