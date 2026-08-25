from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from src.core.config import settings
from src.core.logging import logger

_RESPONSE_FORMAT_GUIDANCE = (
    "Structure answers in clear Markdown with short sections, lists, tables, or code "
    "only when they improve comprehension. Write inline mathematics as $...$ and "
    "display equations as $$...$$ using valid LaTeX. Do not wrap LaTeX in code fences."
)

_CITATION_GUIDANCE = (
    "Cite document evidence inline using the numbered context labels. Put citations "
    "immediately at the end of the sentence or list item they support, using Markdown "
    "links such as [1](#source-1). Use exactly one citation when one context is enough. "
    "Use multiple citations only when that sentence combines claims supported by different "
    "contexts, for example [1](#source-1)[2](#source-2). Never cite a context that does "
    "not support the claim, never invent a source number, and do not add a separate "
    "Sources or References section."
)


class RAGGenerator:
    """Generates answers based on retrieved context using OpenAI / LLM."""

    def __init__(self):
        self.model_name = settings.LLM_MODEL_NAME
        self.api_key = settings.OPENAI_API_KEY
        self._client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None

    def _build_prompt(self, query: str, contexts: List[Dict[str, Any]]) -> str:
        """Format retrieved context and user query into prompt."""
        formatted_contexts = []
        for idx, ctx in enumerate(contexts, 1):
            source = ctx.get("source", "doc")
            url = ctx.get("url")
            text = ctx.get("text", "")
            source_label = f"{source} — {url}" if url else source
            formatted_contexts.append(f"[{idx}] (Source: {source_label})\n{text}")

        context_str = "\n\n".join(formatted_contexts) if formatted_contexts else "No context found."

        prompt = f"""Use the following pieces of context to answer the user's question accurately.
If you don't know the answer or if the context does not contain enough information, state clearly what you know based ONLY on the context.

=== CONTEXT ===
{context_str}

=== QUESTION ===
{query}

=== ANSWER ===
"""
        return prompt

    @staticmethod
    def _build_rag_system_prompt(system_prompt: str = "") -> str:
        """Build shared instructions for normal and streaming RAG responses."""
        role_prompt = system_prompt or "You are a helpful and precise RAG assistant."
        return f"{role_prompt}\n\n{_RESPONSE_FORMAT_GUIDANCE}\n\n{_CITATION_GUIDANCE}"

    async def generate_response(
        self,
        query: str,
        contexts: List[Dict[str, Any]],
        system_prompt: str = "",
        image_data_url: str | None = None,
    ) -> str:
        """Generate complete answer string for the query."""
        user_prompt = self._build_prompt(query, contexts)
        sys_prompt = self._build_rag_system_prompt(system_prompt)

        user_content: Any = user_prompt
        if image_data_url:
            user_content = [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ]

        if self._client:
            try:
                response = await self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=0.2,
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                logger.error(f"LLM API generation error: {e}")

        # Fallback response when LLM API key is not configured
        context_preview = "\n- ".join([c.get("text", "")[:100] for c in contexts[:3]])
        return (
            f"[RAG Response] (Fallback mode - OPENAI_API_KEY not set)\n"
            f"Question: {query}\n"
            f"Attached document crop: {'yes' if image_data_url else 'no'}\n"
            f"Retrieved {len(contexts)} contexts.\n"
            f"Context preview:\n- {context_preview}"
        )

    async def generate_general_response(self, query: str) -> str:
        """Answer without retrieval context for the General Chat screen."""
        if self._client:
            try:
                response = await self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": f"You are ICU Tutor, a helpful learning assistant.\n\n{_RESPONSE_FORMAT_GUIDANCE}"},
                        {"role": "user", "content": query},
                    ],
                    temperature=0.4,
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                logger.error(f"General chat generation error: {e}")

        return (
            "[General Chat] (Fallback mode - OPENAI_API_KEY not set)\n"
            f"Question: {query}"
        )

    async def generate_stream(
        self, query: str, contexts: List[Dict[str, Any]], system_prompt: str = ""
    ) -> AsyncGenerator[str, None]:
        """Stream generated response token by token."""
        user_prompt = self._build_prompt(query, contexts)
        sys_prompt = self._build_rag_system_prompt(system_prompt)

        if self._client:
            try:
                stream = await self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    stream=True,
                )
                async for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                logger.error(f"LLM Streaming error: {e}")

        # Fallback stream
        fallback_msg = await self.generate_response(query, contexts, system_prompt)
        for word in fallback_msg.split(" "):
            yield word + " "


generator = RAGGenerator()
