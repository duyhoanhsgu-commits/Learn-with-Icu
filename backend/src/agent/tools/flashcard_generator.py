"""Generate structured flashcards from one Learning Space."""

import json
import re
import uuid

from openai import AsyncOpenAI
from pydantic import ValidationError

from src.api.schemas import Flashcard, FlashcardSetResponse
from src.core.config import settings
from src.core.logging import logger
from src.rag.retriever import retriever

_DEFAULT_CARD_COUNT = 15
_MAX_CARD_COUNT = 50


def extract_card_count(prompt: str) -> int:
    patterns = (
        r"\b(\d{1,2})\s*(?:flashcards?|cards?|thẻ)\b",
        r"\b(?:create|generate|make|tạo|soạn)\D{0,20}(\d{1,2})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, prompt, flags=re.IGNORECASE)
        if match:
            return max(1, min(int(match.group(1)), _MAX_CARD_COUNT))
    return _DEFAULT_CARD_COUNT


def _context_text(contexts: list[dict]) -> str:
    return "\n\n".join(
        f"[Source {index}: {item.get('source', 'document')}]\n{item.get('text', '')}"
        for index, item in enumerate(contexts, start=1)
    )


async def generate_flashcards(space_id: str, prompt: str) -> FlashcardSetResponse:
    card_count = extract_card_count(prompt)
    contexts = await retriever.retrieve(
        query=prompt,
        top_k=15,
        score_threshold=0.0,
        filter_dict={"space_id": space_id},
    )
    if not contexts:
        raise ValueError("Không tìm thấy nội dung tài liệu để tạo flashcards.")
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required to generate flashcards.")

    instruction = f"""Create study flashcards using ONLY the document context below.
The learner's customization request is: {prompt}

Return valid JSON with exactly this shape:
{{
  "title": "short flashcard set title",
  "cards": [
    {{"front": "clear question or term", "back": "concise answer or explanation"}}
  ]
}}

Requirements:
- Produce exactly {card_count} cards.
- Each front must test one useful concept and have one unambiguous back.
- Mix definitions, relationships, processes, and applications when supported.
- Keep cards self-contained, concise, and free of duplicate facts.
- Do not invent facts outside the supplied context.

DOCUMENT CONTEXT:
{_context_text(contexts)}
"""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": "You create accurate educational flashcards as strict JSON."},
                {"role": "user", "content": instruction},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        cards = [Flashcard.model_validate(item) for item in payload.get("cards", [])]
        if len(cards) != card_count:
            raise ValueError(f"LLM returned {len(cards)} cards instead of {card_count}.")
        return FlashcardSetResponse(
            id=str(uuid.uuid4()),
            title=str(payload.get("title") or "Document flashcards"),
            prompt=prompt,
            card_count=card_count,
            cards=cards,
        )
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        logger.error(f"Invalid structured flashcard response: {exc}")
        raise RuntimeError("LLM returned an invalid flashcard structure.") from exc
    except Exception as exc:
        logger.error(f"Flashcard generation failed: {exc}")
        raise RuntimeError("Could not generate flashcards.") from exc
