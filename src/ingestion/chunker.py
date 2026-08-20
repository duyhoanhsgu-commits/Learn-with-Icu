from typing import List, Dict, Any


class TextChunker:
    """Chunks long text content into manageable overlapping chunks for vector embedding."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks recursively using double newlines, newlines, spaces, or characters."""
        if not text:
            return []

        separators = ["\n\n", "\n", " ", ""]
        return self._recursive_split(text, separators, self.chunk_size, self.chunk_overlap)

    def _recursive_split(
        self, text: str, separators: List[str], max_size: int, overlap: int
    ) -> List[str]:
        final_chunks: List[str] = []
        if len(text) <= max_size or not separators:
            return [text.strip()] if text.strip() else []

        sep = separators[0]
        splits = text.split(sep) if sep else list(text)

        current_chunk = ""
        for piece in splits:
            item = piece + sep if sep else piece
            if len(current_chunk) + len(item) <= max_size:
                current_chunk += item
            else:
                if current_chunk.strip():
                    final_chunks.append(current_chunk.strip())
                
                # Apply overlap by keeping tail end of previous chunk
                if overlap > 0 and len(current_chunk) > overlap:
                    current_chunk = current_chunk[-overlap:] + item
                else:
                    current_chunk = item

        if current_chunk.strip():
            final_chunks.append(current_chunk.strip())

        return final_chunks

    def create_chunk_payloads(
        self, chunks: List[str], base_metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Attach chunk index and metadata to each chunk."""
        payloads = []
        for idx, chunk in enumerate(chunks):
            payload = {
                **base_metadata,
                "chunk_index": idx,
                "chunk_size": len(chunk),
                "text": chunk,
            }
            payloads.append(payload)
        return payloads
