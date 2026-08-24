"""Generate a structured mind map from one Learning Space."""

import json
import uuid

from openai import AsyncOpenAI
from pydantic import ValidationError

from src.api.schemas import MindMapNode, MindMapResponse
from src.core.config import settings
from src.core.logging import logger
from src.rag.retriever import retriever


def _context_text(contexts: list[dict]) -> str:
    return "\n\n".join(
        f"[Source {index}: {item.get('source', 'document')}]\n{item.get('text', '')}"
        for index, item in enumerate(contexts, start=1)
    )


async def generate_mindmap(space_id: str, prompt: str) -> MindMapResponse:
    contexts = await retriever.retrieve(
        query=prompt,
        top_k=15,
        score_threshold=0.0,
        filter_dict={"space_id": space_id},
    )
    if not contexts:
        raise ValueError("Không tìm thấy nội dung tài liệu để tạo mind map.")
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required to generate a mind map.")

    instruction = f"""Create a concise study mind map using ONLY the document context below.
The learner's customization request is: {prompt}

Return valid JSON with exactly this shape:
{{
  "title": "short mind map title",
  "root": {{
    "label": "central topic",
    "description": "one-sentence overview",
    "children": [
      {{
        "label": "major branch",
        "description": "short explanation",
        "children": [
          {{"label": "subtopic", "description": "short explanation", "children": []}}
        ]
      }}
    ]
  }}
}}

Requirements:
- Use 3 to 8 major branches when the context supports them.
- Use no more than 3 levels below the central topic.
- Keep labels short and descriptions factual.
- Group related concepts and avoid duplicate nodes.
- Do not invent facts outside the supplied context.

DOCUMENT CONTEXT:
{_context_text(contexts)}
"""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL_NAME,
            messages=[
                {"role": "system", "content": "You create accurate educational mind maps as strict JSON."},
                {"role": "user", "content": instruction},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        root = MindMapNode.model_validate(payload.get("root"))
        if not root.children:
            raise ValueError("Mind map must contain at least one branch.")
        return MindMapResponse(
            id=str(uuid.uuid4()),
            title=str(payload.get("title") or root.label),
            prompt=prompt,
            root=root,
        )
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        logger.error(f"Invalid structured mind map response: {exc}")
        raise RuntimeError("LLM returned an invalid mind map structure.") from exc
    except Exception as exc:
        logger.error(f"Mind map generation failed: {exc}")
        raise RuntimeError("Could not generate mind map.") from exc
