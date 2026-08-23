"""Generate structured quizzes from a Learning Space with an LLM."""

import json
import re
import uuid

from openai import AsyncOpenAI
from pydantic import ValidationError

from src.api.schemas import QuizQuestion, QuizResponse
from src.core.config import settings
from src.core.logging import logger
from src.rag.retriever import retriever

_DEFAULT_QUESTION_COUNT = 10
_MAX_QUESTION_COUNT = 30


def extract_question_count(prompt: str) -> int:
    """Extract an explicit quiz size, otherwise return the product default."""
    patterns = (
        r"\b(\d{1,2})\s*(?:questions?|câu(?:\s+hỏi)?|quiz(?:zes)?)\b",
        r"\b(?:create|generate|make|tạo|soạn)\D{0,20}(\d{1,2})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, prompt, flags=re.IGNORECASE)
        if match:
            return max(1, min(int(match.group(1)), _MAX_QUESTION_COUNT))
    return _DEFAULT_QUESTION_COUNT


def _context_text(contexts: list[dict]) -> str:
    return "\n\n".join(
        f"[Source {index}: {item.get('source', 'document')}]\n{item.get('text', '')}"
        for index, item in enumerate(contexts, start=1)
    )


async def generate_quiz(space_id: str, prompt: str) -> QuizResponse:
    question_count = extract_question_count(prompt)
    contexts = await retriever.retrieve(
        query=prompt,
        top_k=12,
        score_threshold=0.0,
        filter_dict={"space_id": space_id},
    )
    if not contexts:
        raise ValueError("Không tìm thấy nội dung tài liệu để tạo quiz.")
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required to generate a structured quiz.")

    instruction = f"""Create a quiz using ONLY the document context below.
The learner's customization request is: {prompt}

Return valid JSON with exactly this shape:
{{
  "title": "short quiz title",
  "questions": [
    {{
      "question": "question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "why the correct option is correct"
    }}
  ]
}}

Requirements:
- Produce exactly {question_count} questions.
- Every question must have exactly four plausible, distinct options.
- correct_index is zero-based from 0 to 3.
- Avoid trick questions and do not invent facts outside the context.
- Cover different concepts rather than repeating the same fact.

DOCUMENT CONTEXT:
{_context_text(contexts)}
"""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": "You generate accurate educational quizzes as strict JSON."},
                {"role": "user", "content": instruction},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        questions = [QuizQuestion.model_validate(item) for item in payload.get("questions", [])]
        if len(questions) != question_count:
            raise ValueError(f"LLM returned {len(questions)} questions instead of {question_count}.")
        return QuizResponse(
            id=str(uuid.uuid4()),
            title=str(payload.get("title") or "Document quiz"),
            prompt=prompt,
            question_count=question_count,
            questions=questions,
        )
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.error(f"Invalid structured quiz response: {exc}")
        raise RuntimeError("LLM returned an invalid quiz structure.") from exc
    except Exception as exc:
        logger.error(f"Quiz generation failed: {exc}")
        raise RuntimeError("Could not generate quiz.") from exc
