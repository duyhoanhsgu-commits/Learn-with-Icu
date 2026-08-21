import re
from typing import Any, Dict, List

import tiktoken

from src.core.config import settings


class TextChunker:
    """Recursive, token-aware chunker that prefers semantic boundaries."""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 75,
        model_name: str = settings.EMBEDDING_MODEL_NAME,
    ):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if chunk_overlap < 0 or chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be between 0 and chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        try:
            self.encoding = tiktoken.encoding_for_model(model_name)
        except KeyError:
            self.encoding = tiktoken.get_encoding("cl100k_base")

    def token_count(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def split_text(self, text: str) -> List[str]:
        """Split at section/paragraph boundaries before sentences and tokens."""
        text = text.strip()
        if not text:
            return []
        return self._merge_with_overlap(self._semantic_units(text))

    def _semantic_units(self, text: str) -> List[str]:
        if self.token_count(text) <= self.chunk_size:
            return [text.strip()]

        # Prefer sections/paragraphs, then lines and complete sentences.
        for pattern in [r"\n\s*\n+", r"\n+", r"(?<=[.!?])\s+"]:
            pieces = [piece.strip() for piece in re.split(pattern, text) if piece.strip()]
            if len(pieces) > 1:
                units: List[str] = []
                for piece in pieces:
                    units.extend(self._semantic_units(piece))
                return units

        # An indivisible long sentence is cut only at tokenizer boundaries.
        tokens = self.encoding.encode(text)
        return [
            self.encoding.decode(tokens[start:start + self.chunk_size])
            for start in range(0, len(tokens), self.chunk_size)
            if tokens[start:start + self.chunk_size]
        ]

    def _merge_with_overlap(self, units: List[str]) -> List[str]:
        chunks: List[str] = []
        current_tokens: List[int] = []

        for unit in units:
            remaining = self.encoding.encode(unit)
            separator_tokens = self.encoding.encode("\n\n") if current_tokens else []
            if current_tokens and len(current_tokens) + len(separator_tokens) + len(remaining) > self.chunk_size:
                chunks.append(self.encoding.decode(current_tokens))
                current_tokens = current_tokens[-self.chunk_overlap:] if self.chunk_overlap else []
                separator_tokens = self.encoding.encode("\n\n") if current_tokens else []

            while len(current_tokens) + len(separator_tokens) + len(remaining) > self.chunk_size:
                capacity = self.chunk_size - len(current_tokens) - len(separator_tokens)
                if capacity <= 0:
                    chunks.append(self.encoding.decode(current_tokens))
                    current_tokens = current_tokens[-self.chunk_overlap:] if self.chunk_overlap else []
                    separator_tokens = []
                    continue
                current_tokens.extend(separator_tokens + remaining[:capacity])
                chunks.append(self.encoding.decode(current_tokens))
                current_tokens = current_tokens[-self.chunk_overlap:] if self.chunk_overlap else []
                remaining = remaining[capacity:]
                separator_tokens = []

            if remaining:
                current_tokens.extend(separator_tokens + remaining)

        if current_tokens:
            candidate = self.encoding.decode(current_tokens)
            if candidate and (not chunks or candidate != chunks[-1]):
                chunks.append(candidate)
        return chunks

    def create_chunk_payloads(
        self, chunks: List[str], base_metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Attach chunk index and token-aware metadata to each chunk."""
        return [
            {
                **base_metadata,
                "chunk_index": idx,
                "chunk_size": self.token_count(chunk),
                "character_count": len(chunk),
                "text": chunk,
            }
            for idx, chunk in enumerate(chunks)
        ]
