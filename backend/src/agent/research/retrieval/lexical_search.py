"""Space-scoped lexical retrieval with a dependency-free BM25 fallback."""

import math
import re
from collections import Counter
from typing import Any

from sqlalchemy import or_, select

from src.agent.research.config import research_settings
from src.storage.postgres import AsyncSessionLocal, Document, DocumentChunk

_WORD_PATTERN = re.compile(r"\w+", flags=re.UNICODE)


def lexical_terms(value: str) -> list[str]:
    return [token.casefold() for token in _WORD_PATTERN.findall(value) if len(token) >= 3]


def build_lexical_statement(query: str, space_id: str):
    """Build the bounded SQL candidate query with isolation in the WHERE clause."""
    terms = list(dict.fromkeys(lexical_terms(query)))[:12]
    statement = (
        select(DocumentChunk, Document.filename)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.space_id == space_id)
    )
    if terms:
        statement = statement.where(or_(*[
            DocumentChunk.content.ilike(f"%{term}%") for term in terms
        ]))
    return statement.limit(research_settings.lexical_scan_limit)


def bm25_rank(
    query: str,
    rows: list[tuple[Any, str]],
    top_k: int,
) -> list[dict[str, Any]]:
    query_terms = lexical_terms(query)
    if not query_terms or not rows:
        return []
    documents = [lexical_terms(chunk.content) for chunk, _ in rows]
    average_length = sum(map(len, documents)) / max(1, len(documents))
    document_frequency = {
        term: sum(1 for document in documents if term in set(document))
        for term in set(query_terms)
    }
    ranked: list[tuple[float, Any, str]] = []
    for (chunk, filename), tokens in zip(rows, documents):
        counts = Counter(tokens)
        score = 0.0
        for term in query_terms:
            frequency = counts[term]
            if not frequency:
                continue
            frequency_docs = document_frequency[term]
            inverse_frequency = math.log(1 + (len(rows) - frequency_docs + 0.5) / (frequency_docs + 0.5))
            normalization = frequency + 1.5 * (1 - 0.75 + 0.75 * len(tokens) / max(1, average_length))
            score += inverse_frequency * (frequency * 2.5) / normalization
        if score > 0:
            ranked.append((score, chunk, filename))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked:
        return []
    maximum = ranked[0][0]
    return [{
        "chunk_id": str(chunk.id),
        "score": score / maximum if maximum else 0.0,
        "lexical_score": score,
        "text": chunk.content,
        "source": filename,
        "document_id": str(chunk.document_id),
        "chunk_index": chunk.chunk_index,
    } for score, chunk, filename in ranked[:top_k]]


class LexicalResearchRetriever:
    def __init__(self, session_factory=AsyncSessionLocal):
        self.session_factory = session_factory

    async def search(self, query: str, space_id: str, top_k: int) -> list[dict[str, Any]]:
        if not space_id:
            return []
        async with self.session_factory() as session:
            result = await session.execute(build_lexical_statement(query, space_id))
            return bm25_rank(query, list(result.all()), top_k)
