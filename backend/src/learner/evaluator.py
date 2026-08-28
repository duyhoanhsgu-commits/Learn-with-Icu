import json
import re

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.core.config import settings


class EvaluationResult(BaseModel):
    correctness: float = Field(ge=0, le=1)
    completeness: float = Field(ge=0, le=1)
    understanding: float = Field(ge=0, le=1)
    feedback: str = Field(default="", max_length=3000)


class EvaluationUnavailableError(RuntimeError):
    pass


def _parse_json(value: str) -> dict:
    cleaned = value.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned, re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Evaluator did not return JSON.")
    return json.loads(cleaned[start:end + 1])


class LearnerEvaluator:
    def __init__(self, client=None, model_name: str | None = None):
        self.model_name = model_name or settings.LLM_MODEL_NAME
        self._client = client if client is not None else (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        )

    @staticmethod
    def parse(value: str) -> EvaluationResult:
        payload = _parse_json(value)
        return EvaluationResult(
            correctness=max(0, min(1, float(payload.get("correctness", 0)))),
            completeness=max(0, min(1, float(payload.get("completeness", 0)))),
            understanding=max(0, min(1, float(payload.get("understanding", 0)))),
            feedback=str(payload.get("feedback", "")).strip(),
        )

    async def evaluate(
        self,
        *,
        concept_name: str,
        question: str,
        expected_context: str,
        user_answer: str,
        previous_mastery: float,
    ) -> EvaluationResult:
        if self._client is None:
            raise EvaluationUnavailableError("Automated learner evaluation is unavailable.")
        response = await self._client.chat.completions.create(
            model=self.model_name,
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": (
                    "Evaluate learning evidence using only the supplied source context. Return JSON "
                    "with correctness, completeness, understanding (0 to 1), and concise feedback. "
                    "Do not reward confidence or self-reported mastery without demonstrated reasoning."
                )},
                {"role": "user", "content": (
                    f"Concept: {concept_name}\nPrevious mastery: {previous_mastery:.2f}\n"
                    f"Question/task: {question}\n\nGrounding context:\n{expected_context}\n\n"
                    f"Learner answer:\n{user_answer}"
                )},
            ],
        )
        return self.parse(response.choices[0].message.content or "{}")


learner_evaluator = LearnerEvaluator()
