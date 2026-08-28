import re
from typing import Any, Dict, List

from src.core.config import settings
from src.core.tokenizer import cached_model_encoding


class _WordpieceEncoding:
    """Offline-safe reversible wordpiece approximation."""

    def __init__(self):
        self._piece_to_id: dict[str, int] = {}
        self._id_to_piece: dict[int, str] = {}

    def encode(self, text: str) -> list[int]:
        tokens = []
        for piece in re.findall(r"\s|[\w]+|[^\w\s]", text, re.UNICODE):
            token_id = self._piece_to_id.get(piece)
            if token_id is None:
                token_id = len(self._piece_to_id) + 1
                self._piece_to_id[piece] = token_id
                self._id_to_piece[token_id] = piece
            tokens.append(token_id)
        return tokens

    def decode(self, tokens: list[int]) -> str:
        return "".join(self._id_to_piece[token] for token in tokens)


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
        self.encoding = cached_model_encoding(model_name) or _WordpieceEncoding()

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
