from openai import AsyncOpenAI
from pydantic import BaseModel, Field, field_validator

from src.agent.research.config import research_settings
from src.agent.research.models import ResearchQuestion
from src.agent.research.prompts import QUERY_REWRITE_SYSTEM_PROMPT, QUERY_REWRITE_USER_PROMPT
from src.agent.research.state import ResearchState
from src.core.config import settings
from src.core.logging import logger


class QuestionQueries(BaseModel):
    research_question_id: str
    queries: list[str] = Field(default_factory=list)

    @field_validator("queries")
    @classmethod
    def clean_queries(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = " ".join(value.split()).strip()
            key = normalized.casefold()
            if normalized and key not in seen:
                result.append(normalized)
                seen.add(key)
        return result[:research_settings.max_query_variants]


class QueryRewriteBatch(BaseModel):
    rewrites: list[QuestionQueries] = Field(default_factory=list)


class QueryRewriter:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = None if client is False else client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY else None
        )

    @staticmethod
    def fallback(questions: list[ResearchQuestion]) -> QueryRewriteBatch:
        rewrites: list[QuestionQueries] = []
        for question in questions:
            queries = [question.search_query]
            if question.type == "current_state":
                queries.append(f"{question.search_query} latest official")
            elif question.type == "evidence":
                queries.append(f"{question.search_query} study results")
            elif question.type in {"limitation", "criticism"}:
                queries.append(f"{question.search_query} limitations criticism")
            elif question.type in {"mechanism", "architecture"}:
                queries.append(f"{question.search_query} technical explanation")
            rewrites.append(QuestionQueries(
                research_question_id=question.id,
                queries=queries,
            ))
        return QueryRewriteBatch(rewrites=rewrites)

    async def rewrite(self, state: ResearchState) -> QueryRewriteBatch:
        fallback = self.fallback(state.research_plan)
        if not self._client:
            return fallback
        questions = "\n".join(
            f"- {item.id}: {item.question} | type={item.type} | seed={item.search_query}"
            for item in state.research_plan
        )
        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": QUERY_REWRITE_SYSTEM_PROMPT},
                    {"role": "user", "content": QUERY_REWRITE_USER_PROMPT.format(
                        query=state.query,
                        questions=questions,
                        max_variants=research_settings.max_query_variants,
                    )},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
            return QueryRewriteBatch.model_validate_json(
                response.choices[0].message.content or "{}"
            )
        except Exception as exc:
            logger.warning(f"Research query rewrite failed; using fallback: {exc}")
            return fallback

    async def run(self, state: ResearchState) -> ResearchState:
        state.progress("research.rewrite", "Rewriting retrieval queries")
        batch = await self.rewrite(state)
        questions = {item.id: item for item in state.research_plan}
        supplied = {item.research_question_id: item.queries for item in batch.rewrites}
        seen: set[str] = set()
        state.question_query_map = {}
        state.query_question_map = {}
        state.search_queries = []
        for question_id, question in questions.items():
            candidates = supplied.get(question_id) or [question.search_query]
            accepted: list[str] = []
            for query in candidates:
                normalized = " ".join(query.split()).strip()
                key = normalized.casefold()
                if not normalized or key in seen:
                    continue
                seen.add(key)
                accepted.append(normalized)
                state.search_queries.append(normalized)
                state.query_question_map[normalized] = question.question
                if len(accepted) >= research_settings.max_query_variants:
                    break
            if not accepted and question.search_query.casefold() not in seen:
                accepted = [question.search_query]
                seen.add(question.search_query.casefold())
                state.search_queries.append(question.search_query)
                state.query_question_map[question.search_query] = question.question
            state.question_query_map[question_id] = accepted
        return state


async def query_rewrite_node(
    state: ResearchState,
    rewriter: QueryRewriter,
) -> ResearchState:
    return await rewriter.run(state)
