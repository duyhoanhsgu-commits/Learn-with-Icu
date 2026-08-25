from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator, model_validator

from src.agent.research.prompts import PLANNER_SYSTEM_PROMPT, PLANNER_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger

MIN_RESEARCH_QUESTIONS = 3
MAX_RESEARCH_QUESTIONS = 6


class ResearchPlan(BaseModel):
    research_questions: list[str] = Field(
        min_length=MIN_RESEARCH_QUESTIONS,
        max_length=MAX_RESEARCH_QUESTIONS,
    )
    search_queries: list[str] = Field(
        min_length=MIN_RESEARCH_QUESTIONS,
        max_length=MAX_RESEARCH_QUESTIONS,
    )

    @field_validator("research_questions", "search_queries")
    @classmethod
    def clean_unique_values(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = " ".join(value.split()).strip()
            key = normalized.casefold()
            if normalized and key not in seen:
                cleaned.append(normalized)
                seen.add(key)
        return cleaned

    @model_validator(mode="after")
    def matching_lengths(self) -> "ResearchPlan":
        if not MIN_RESEARCH_QUESTIONS <= len(self.research_questions) <= MAX_RESEARCH_QUESTIONS:
            raise ValueError("A research plan must contain 3 to 6 unique questions.")
        if not MIN_RESEARCH_QUESTIONS <= len(self.search_queries) <= MAX_RESEARCH_QUESTIONS:
            raise ValueError("A research plan must contain 3 to 6 unique search queries.")
        if len(self.research_questions) != len(self.search_queries):
            raise ValueError("Each research question must have one search query.")
        return self


class ResearchPlanner:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY
            else None
        )

    @staticmethod
    def fallback(query: str) -> ResearchPlan:
        subject = " ".join(query.split()).strip()
        return ResearchPlan(
            research_questions=[
                subject,
                f"What mechanisms and evidence are most relevant to: {subject}",
                f"What practical trade-offs, limitations, and costs apply to: {subject}",
            ],
            search_queries=[
                subject,
                f"{subject} mechanism evidence",
                f"{subject} use cases tradeoffs cost",
            ],
        )

    async def plan(self, query: str) -> ResearchPlan:
        fallback = self.fallback(query)
        if not self._client:
            return fallback
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
                    {"role": "user", "content": PLANNER_USER_PROMPT.format(query=query)},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
            return ResearchPlan.model_validate_json(
                response.choices[0].message.content or "{}"
            )
        except Exception as exc:
            logger.warning(f"Research planning failed; using fallback plan: {exc}")
            return fallback


async def planner_node(state: ResearchState, planner: ResearchPlanner) -> ResearchState:
    state.progress("research.plan", "Planning research questions")
    plan = await planner.plan(state.query)
    state.research_questions = plan.research_questions
    state.search_queries = plan.search_queries
    state.query_question_map = dict(zip(plan.search_queries, plan.research_questions))
    return state
