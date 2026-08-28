import re
import urllib.parse
from difflib import SequenceMatcher
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from src.agent.research.state import ResearchState

_WORD_PATTERN = re.compile(r"\w+", flags=re.UNICODE)
_YEAR_PATTERN = re.compile(r"\b(20[0-9]{2})\b")
_HIGH_AUTHORITY_HOSTS = {
    "arxiv.org",
    "doi.org",
    "nature.com",
    "science.org",
    "acm.org",
    "ieee.org",
    "nih.gov",
}
_PRACTICAL_HOSTS = {"github.com", "stackoverflow.com", "medium.com", "substack.com"}


def source_terms(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _WORD_PATTERN.findall(value)
        if len(token) >= 3
    }


def authority_score(url: str) -> float:
    host = (urllib.parse.urlsplit(url).hostname or "").casefold()
    if host.endswith((".gov", ".edu", ".ac.uk")) or any(
        host == value or host.endswith(f".{value}") for value in _HIGH_AUTHORITY_HOSTS
    ):
        return 1.0
    if any(host == value or host.endswith(f".{value}") for value in _PRACTICAL_HOSTS):
        return 0.65
    return 0.5


def freshness_score(source: dict[str, Any], freshness_matters: bool) -> float | None:
    if not freshness_matters:
        return None
    visible = " ".join([
        str(source.get("published_at", "")),
        source.get("title", ""),
        source.get("snippet", ""),
    ])
    years = [int(value) for value in _YEAR_PATTERN.findall(visible)]
    if not years:
        return 0.4
    age = max(0, datetime.now(timezone.utc).year - max(years))
    return max(0.0, 1.0 - age / 5)


def score_web_source(source: dict[str, Any], freshness_matters: bool = False) -> float:
    questions = " ".join(source.get("research_questions", []))
    query_text = " ".join([source.get("search_query", ""), questions])
    query_terms = source_terms(query_text)
    visible_text = " ".join([
        source.get("title", ""),
        source.get("snippet", ""),
        source.get("text", "")[:4000],
    ])
    visible_terms = source_terms(visible_text)
    relevance = len(query_terms & visible_terms) / max(1, len(query_terms))
    evidence_density = min(1.0, len(source.get("text") or source.get("snippet", "")) / 1200)
    components = [relevance, authority_score(source.get("url", "")), evidence_density]
    freshness = freshness_score(source, freshness_matters)
    if freshness is not None:
        components.append(freshness)
    return round(mean(components), 6)


def near_duplicate(first: dict[str, Any], second: dict[str, Any]) -> bool:
    first_text = " ".join(
        (first.get("text") or first.get("snippet", ""))[:5000].casefold().split()
    )
    second_text = " ".join(
        (second.get("text") or second.get("snippet", ""))[:5000].casefold().split()
    )
    if not first_text or not second_text:
        return False
    if first_text == second_text:
        return True
    return SequenceMatcher(None, first_text, second_text, autojunk=False).ratio() >= 0.92


class SourceRanker:
    def rank_candidates(
        self,
        candidates: list[dict[str, Any]],
        limit: int,
        freshness_matters: bool = False,
    ) -> list[dict[str, Any]]:
        scored = [
            {**item, "source_quality_score": score_web_source(item, freshness_matters)}
            for item in candidates
        ]
        scored.sort(key=lambda item: item["source_quality_score"], reverse=True)
        selected: list[dict[str, Any]] = []
        covered_queries: set[str] = set()
        for item in scored:
            query = item.get("search_query", "")
            if query and query not in covered_queries:
                selected.append(item)
                covered_queries.add(query)
            if len(selected) >= limit:
                return selected
        for item in scored:
            if item not in selected:
                selected.append(item)
            if len(selected) >= limit:
                break
        return selected

    def rank_sources(
        self,
        sources: list[dict[str, Any]],
        freshness_matters: bool = False,
    ) -> list[dict[str, Any]]:
        ranked = [
            {**item, "source_quality_score": score_web_source(item, freshness_matters)}
            for item in sources
            if item.get("text", "").strip()
        ]
        ranked.sort(key=lambda item: item["source_quality_score"], reverse=True)
        unique: list[dict[str, Any]] = []
        for item in ranked:
            if not any(near_duplicate(item, existing) for existing in unique):
                unique.append(item)
        return unique

    async def run(self, state: ResearchState) -> ResearchState:
        state.progress("research.rank_sources", "Ranking research sources")
        freshness = bool(
            state.query_understanding
            and state.query_understanding.needs_fresh_information
        )
        state.web_sources = self.rank_sources(state.web_sources, freshness)
        state.ranked_sources = sorted(
            [*state.web_sources, *state.local_sources],
            key=lambda item: item.get(
                "source_quality_score",
                item.get("relevance_score", item.get("score", 0.0)),
            ),
            reverse=True,
        )
        return state


async def source_ranker_node(
    state: ResearchState,
    ranker: SourceRanker,
) -> ResearchState:
    return await ranker.run(state)
