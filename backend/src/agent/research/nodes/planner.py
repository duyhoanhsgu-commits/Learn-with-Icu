from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator, model_validator

from src.agent.context import context_builder
from src.agent.research.config import research_settings
from src.agent.research.models import ResearchQuestion
from src.agent.research.prompts import PLANNER_SYSTEM_PROMPT, PLANNER_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger

MIN_RESEARCH_QUESTIONS = research_settings.min_questions
MAX_RESEARCH_QUESTIONS = research_settings.max_questions


class ResearchPlan(BaseModel):
    research_questions: list[str] = Field(default_factory=list)
    search_queries: list[str] = Field(default_factory=list)
    questions: list[ResearchQuestion] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def expand_structured_questions(cls, data):
        if not isinstance(data, dict) or not data.get("questions"):
            return data
        result = dict(data)
        if "research_questions" not in result:
            result["research_questions"] = [
                item.question if isinstance(item, ResearchQuestion) else item.get("question", "")
                for item in result["questions"]
            ]
        if "search_queries" not in result:
            result["search_queries"] = [
                item.search_query if isinstance(item, ResearchQuestion) else item.get("search_query", "")
                for item in result["questions"]
            ]
        return result

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
        if not self.questions:
            default_types = ["background", "mechanism", "limitation"]
            self.questions = [
                ResearchQuestion(
                    id=f"rq_{index + 1}",
                    question=question,
                    type=default_types[index] if index < len(default_types) else "evidence",
                    priority=min(5, index + 1),
                    search_query=self.search_queries[index],
                )
                for index, question in enumerate(self.research_questions)
            ]
        if len(self.questions) != len(self.research_questions):
            raise ValueError("Structured questions must match the compatibility fields.")
        ids = {item.id for item in self.questions}
        if len(ids) != len(self.questions):
            raise ValueError("Research question IDs must be unique.")
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
            questions=[
                ResearchQuestion(
                    id="rq_1",
                    question=subject,
                    type="background",
                    priority=1,
                    search_query=subject,
                ),
                ResearchQuestion(
                    id="rq_2",
                    question=f"What mechanisms and evidence are most relevant to: {subject}",
                    type="mechanism",
                    priority=2,
                    search_query=f"{subject} mechanism evidence",
                ),
                ResearchQuestion(
                    id="rq_3",
                    question=f"What practical trade-offs, limitations, and costs apply to: {subject}",
                    type="limitation",
                    priority=3,
                    search_query=f"{subject} use cases tradeoffs cost",
                ),
            ],
        )

    async def plan(
        self,
        query: str,
        fixed_context: str | None = None,
        memory_context: str | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> ResearchPlan:
        fallback = self.fallback(query)
        if not self._client:
            return fallback
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=context_builder.build_messages(
                    base_system_prompt=PLANNER_SYSTEM_PROMPT,
                    fixed_context=fixed_context,
                    memory_context=memory_context,
                    recent_messages=history,
                    query=PLANNER_USER_PROMPT.format(query=query),
                ),
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
    plan = await planner.plan(
        state.query,
        fixed_context=state.fixed_context,
        memory_context=state.memory_context,
        history=state.history,
    )
    state.research_questions = plan.research_questions
    state.research_plan = plan.questions
    state.search_queries = plan.search_queries
    state.query_question_map = dict(zip(plan.search_queries, plan.research_questions))
    return state
