from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator

from src.agent.context import context_builder
from src.agent.research.prompts import EVALUATE_SYSTEM_PROMPT, EVALUATE_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger


class EvaluationResult(BaseModel):
    enough: bool
    missing_topics: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("missing_topics")
    @classmethod
    def clean_missing_topics(cls, topics: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for topic in topics:
            normalized = " ".join(topic.split()).strip()
            key = normalized.casefold()
            if normalized and key not in seen:
                cleaned.append(normalized)
                seen.add(key)
        return cleaned[:6]


class ResearchEvaluator:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY
            else None
        )

    @staticmethod
    def fallback(state: ResearchState) -> EvaluationResult:
        covered = {
            item.get("research_question")
            for item in state.evidence
            if item.get("evidence")
        }
        missing = [
            question for question in state.research_questions
            if question not in covered
        ]
        return EvaluationResult(enough=bool(state.evidence) and not missing, missing_topics=missing[:6])

    async def evaluate(self, state: ResearchState) -> EvaluationResult:
        fallback = self.fallback(state)
        if not self._client:
            return fallback
        compact_evidence = "\n".join(
            f"- [{item.get('research_question')}] {item.get('claim')}: {item.get('evidence')}"
            for item in state.evidence
        )[:16_000]
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=context_builder.build_messages(
                    base_system_prompt=EVALUATE_SYSTEM_PROMPT,
                    fixed_context=state.fixed_context,
                    memory_context=state.memory_context,
                    retrieved_context=compact_evidence or "No evidence",
                    recent_messages=state.history,
                    query=EVALUATE_USER_PROMPT.format(
                        query=state.query,
                        research_questions="\n".join(f"- {item}" for item in state.research_questions),
                    ),
                ),
                response_format={"type": "json_object"},
                temperature=0,
            )
            result = EvaluationResult.model_validate_json(
                response.choices[0].message.content or "{}"
            )
            if result.enough and not state.evidence:
                return fallback
            return result
        except Exception as exc:
            logger.warning(f"Research evaluation failed; using coverage fallback: {exc}")
            return fallback

    @staticmethod
    def follow_up_queries(state: ResearchState) -> list[str]:
        return list(ResearchEvaluator.follow_up_query_map(state))

    @staticmethod
    def follow_up_query_map(state: ResearchState) -> dict[str, str]:
        previous = {query.casefold() for query in state.searched_queries}
        queries: dict[str, str] = {}
        for topic in state.missing_topics:
            query = f"{topic} {state.query}".strip()
            if query.casefold() not in previous:
                queries[query] = topic
        return queries

    async def run(self, state: ResearchState) -> ResearchState:
        state.progress(
            "research.evaluate",
            "Evaluating evidence coverage",
            current=state.iteration,
        )
        result = await self.evaluate(state)
        state.enough_evidence = result.enough
        state.missing_topics = result.missing_topics
        return state


async def evaluate_node(state: ResearchState, evaluator: ResearchEvaluator) -> ResearchState:
    return await evaluator.run(state)
