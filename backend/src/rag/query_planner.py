"""Plan retrieval queries without changing the user's original question."""

import json
from typing import Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, field_validator, model_validator

from src.core.config import settings
from src.core.logging import logger

MAX_SUB_QUERIES = 4


class QueryPlan(BaseModel):
    type: Literal["simple", "multi_part", "comparison"]
    queries: list[str]

    @field_validator("queries")
    @classmethod
    def clean_queries(cls, queries: list[str]) -> list[str]:
        cleaned: list[str] = []
        for query in queries:
            normalized = query.strip()
            if normalized and normalized not in cleaned:
                cleaned.append(normalized)
        if not cleaned:
            raise ValueError("A query plan must contain at least one retrieval query.")
        return cleaned[:MAX_SUB_QUERIES]

    @model_validator(mode="after")
    def validate_complex_plan(self) -> "QueryPlan":
        if self.type != "simple" and len(self.queries) < 2:
            raise ValueError("A complex query plan must contain at least two queries.")
        return self


class QueryPlanner:
    """Use an LLM only to decompose a question into retrieval queries."""

    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client or (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY
            else None
        )

    @staticmethod
    def fallback(original_query: str) -> QueryPlan:
        return QueryPlan(type="simple", queries=[original_query])

    async def plan(self, original_query: str) -> QueryPlan:
        """Return retrieval queries, never an answer to the user's question."""
        fallback = self.fallback(original_query)
        if not self._client:
            return fallback

        instruction = f"""Analyze the user's question only to plan document retrieval.
Do not answer the question and do not add factual claims.

Return one JSON object with exactly these fields:
{{
  "type": "simple" | "multi_part" | "comparison",
  "queries": ["retrieval query"]
}}

Rules:
- Use "simple" for one information need and preserve the original question as its only query.
- Use "multi_part" when the user asks multiple independent things.
- Use "comparison" when the user asks for differences, similarities, trade-offs, or a comparison.
- For a comparison, retrieve the concepts being compared separately so the final generator has evidence for each side.
- Produce at most {MAX_SUB_QUERIES} concise, self-contained retrieval queries.
- The queries are search queries only. Never include an answer.

Examples:
User: RAG là gì?
Output: {{"type":"simple","queries":["RAG là gì?"]}}

User: RAG là gì và RAG khác Fine-tuning như thế nào?
Output: {{"type":"comparison","queries":["RAG là gì?","Fine-tuning là gì?"]}}

User question:
{original_query}
"""

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a retrieval query planner. Return strict JSON and never answer the question.",
                    },
                    {"role": "user", "content": instruction},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
            content = response.choices[0].message.content or ""
            plan = QueryPlan.model_validate(json.loads(content))
            if plan.type == "simple":
                return fallback
            return plan
        except Exception as exc:
            logger.warning(f"Query planning failed; using original query: {exc}")
            return fallback


query_planner = QueryPlanner()
