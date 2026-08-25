import asyncio
import urllib.parse
from collections.abc import Callable
from typing import Any

from src.agent.research.state import ResearchState
from src.agent.research.tools import fetch_url, search_results
from src.core.logging import logger

MAX_SEARCH_RESULTS_PER_QUERY = 5
MAX_TOTAL_SOURCES = 10
FOLLOW_UP_SOURCE_RESERVE = 3
_TRACKING_PARAMETERS = {"fbclid", "gclid"}


def canonical_url(url: str) -> str:
    """Normalize a public result URL for stable deduplication."""
    parsed = urllib.parse.urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return ""
    host = parsed.hostname.casefold()
    port = parsed.port
    if port and not ((parsed.scheme == "https" and port == 443) or (parsed.scheme == "http" and port == 80)):
        host = f"{host}:{port}"
    query = urllib.parse.urlencode(sorted(
        (key, value)
        for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        if not key.casefold().startswith("utm_") and key.casefold() not in _TRACKING_PARAMETERS
    ))
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit((parsed.scheme.casefold(), host, path, query, ""))


class ResearchSearcher:
    def __init__(
        self,
        search_fn: Callable[..., list[dict[str, str]]] = search_results,
        fetch_fn: Callable[[str], dict[str, str]] = fetch_url,
    ):
        self.search_fn = search_fn
        self.fetch_fn = fetch_fn

    async def run(self, state: ResearchState) -> ResearchState:
        searched = {query.casefold() for query in state.searched_queries}
        queries = list(dict.fromkeys(
            query for query in state.search_queries
            if query.strip() and query.casefold() not in searched
        ))
        remaining_capacity = MAX_TOTAL_SOURCES - len(state.web_sources)
        if not queries or remaining_capacity <= 0:
            return state

        is_initial_search = state.iteration == 0
        state.iteration += 1
        state.progress(
            "research.search",
            "Searching web sources",
            current=state.iteration,
            total=len(queries),
        )
        search_batches = await asyncio.gather(*[
            asyncio.to_thread(self.search_fn, query, MAX_SEARCH_RESULTS_PER_QUERY)
            for query in queries
        ], return_exceptions=True)
        state.searched_queries.extend(queries)

        existing_urls = {canonical_url(source.get("url", "")) for source in state.web_sources}
        candidates: dict[str, dict[str, Any]] = {}
        for query_index, (query, batch) in enumerate(zip(queries, search_batches)):
            if isinstance(batch, Exception):
                logger.warning(f"Research search failed for {query!r}: {batch}")
                continue
            research_question = state.query_question_map.get(query, query)
            for result_index, result in enumerate(batch[:MAX_SEARCH_RESULTS_PER_QUERY]):
                normalized_url = canonical_url(result.get("url", ""))
                if not normalized_url or normalized_url in existing_urls:
                    continue
                if normalized_url in candidates:
                    questions = candidates[normalized_url]["research_questions"]
                    if research_question not in questions:
                        questions.append(research_question)
                    continue
                candidates[normalized_url] = {
                    "title": result.get("title") or normalized_url,
                    "url": result.get("url", normalized_url),
                    "snippet": result.get("snippet", ""),
                    "search_query": query,
                    "research_questions": [research_question],
                    "priority": (result_index, query_index),
                }

        candidate_capacity = remaining_capacity
        if is_initial_search:
            candidate_capacity = max(
                1,
                remaining_capacity - min(FOLLOW_UP_SOURCE_RESERVE, remaining_capacity - 1),
            )
        candidate_list = sorted(
            candidates.values(),
            key=lambda item: item["priority"],
        )[:candidate_capacity]
        for candidate in candidate_list:
            candidate.pop("priority", None)
        state.progress(
            "research.read",
            "Reading candidate sources",
            current=0,
            total=len(candidate_list),
        )
        fetched_pages = await asyncio.gather(*[
            asyncio.to_thread(self.fetch_fn, candidate["url"])
            for candidate in candidate_list
        ], return_exceptions=True)

        for candidate, page in zip(candidate_list, fetched_pages):
            if isinstance(page, Exception):
                logger.warning(f"Skipping unreadable research URL {candidate['url']}: {page}")
                continue
            state.web_sources.append({
                **candidate,
                "title": page.get("title") or candidate["title"],
                "url": page.get("url") or candidate["url"],
                "text": page.get("text", ""),
                "source_type": "web",
                "extracted": False,
            })
            if len(state.web_sources) >= MAX_TOTAL_SOURCES:
                break
        return state


async def search_node(state: ResearchState, searcher: ResearchSearcher) -> ResearchState:
    return await searcher.run(state)
