import re

from openai import AsyncOpenAI

from src.agent.context import context_builder
from src.agent.research.models import QueryUnderstanding
from src.agent.research.prompts import UNDERSTAND_SYSTEM_PROMPT, UNDERSTAND_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger

_FRESHNESS_PATTERN = re.compile(
    r"\b(latest|current|today|recent|newest|now|202[4-9]|mới nhất|hiện tại|gần đây)\b",
    flags=re.IGNORECASE,
)
_LOCAL_PATTERN = re.compile(
    r"\b(uploaded|document|file|notes?|paper|tài liệu|đã tải|trong file)\b",
    flags=re.IGNORECASE,
)


class QueryUnderstandingNode:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = None if client is False else client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY else None
        )

    @staticmethod
    def fallback(query: str, has_space: bool) -> QueryUnderstanding:
        topic = " ".join(query.split()).strip()
        needs_fresh = bool(_FRESHNESS_PATTERN.search(query))
        explicitly_local = bool(_LOCAL_PATTERN.search(query))
        return QueryUnderstanding(
            topic=topic,
            depth="deep",
            needs_fresh_information=needs_fresh,
            use_local_sources=has_space,
            use_web_sources=needs_fresh or not explicitly_local or not has_space,
        )

    async def understand(self, state: ResearchState) -> QueryUnderstanding:
        fallback = self.fallback(state.query, bool(state.space_id))
        if not self._client:
            return fallback
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=context_builder.build_messages(
                    base_system_prompt=UNDERSTAND_SYSTEM_PROMPT,
                    fixed_context=state.fixed_context,
                    memory_context=state.memory_context,
                    recent_messages=state.history,
                    query=UNDERSTAND_USER_PROMPT.format(query=state.query),
                ),
                response_format={"type": "json_object"},
                temperature=0,
            )
            result = QueryUnderstanding.model_validate_json(
                response.choices[0].message.content or "{}"
            )
            if not state.space_id:
                result.use_local_sources = False
            return result
        except Exception as exc:
            logger.warning(f"Research query understanding failed; using fallback: {exc}")
            return fallback

    async def run(self, state: ResearchState) -> ResearchState:
        state.progress("research.understand", "Understanding research question")
        state.query_understanding = await self.understand(state)
        return state


async def understand_node(
    state: ResearchState,
    understander: QueryUnderstandingNode,
) -> ResearchState:
    return await understander.run(state)
