"""Web search tool with Tavily and DuckDuckGo providers."""

import json
import re
import urllib.parse
import urllib.request
from html import unescape
from typing import Dict, List

from src.core.config import settings
from src.core.logging import logger

SearchResult = Dict[str, str]

_REQUEST_TIMEOUT_SECONDS = 10
_MAX_RESULTS_LIMIT = 10
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _plain_text(value: str) -> str:
    """Remove HTML markup and normalize whitespace."""
    without_tags = re.sub(r"<[^>]+>", "", value)
    return " ".join(unescape(without_tags).split())


def _normalize_duckduckgo_url(raw_url: str) -> str:
    """Resolve DuckDuckGo redirect links to their original target."""
    url = unescape(raw_url.strip())
    parsed = urllib.parse.urlparse(url)
    redirect_target = urllib.parse.parse_qs(parsed.query).get("uddg")
    if redirect_target:
        return redirect_target[0]
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url.lstrip('/')}"


def _search_duckduckgo(query: str, max_results: int = 5) -> List[SearchResult]:
    """Search DuckDuckGo's HTML endpoint without an API key."""
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})

    try:
        with urllib.request.urlopen(
            request, timeout=_REQUEST_TIMEOUT_SECONDS
        ) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        logger.error(f"DuckDuckGo search failed: {exc}")
        return []

    pattern = re.compile(
        r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>'
        r"(.*?)</a>.*?"
        r'<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>',
        re.DOTALL | re.IGNORECASE,
    )
    results: List[SearchResult] = []
    for raw_url, raw_title, raw_snippet in pattern.findall(html)[:max_results]:
        results.append(
            {
                "title": _plain_text(raw_title),
                "url": _normalize_duckduckgo_url(raw_url),
                "snippet": _plain_text(raw_snippet),
            }
        )
    return results


def _search_tavily(
    query: str, api_key: str, max_results: int = 5
) -> List[SearchResult]:
    """Search the web through the Tavily Search API."""
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
    }
    request = urllib.request.Request(
        "https://api.tavily.com/search",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": _USER_AGENT},
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request, timeout=_REQUEST_TIMEOUT_SECONDS
        ) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        logger.error(f"Tavily search failed: {exc}")
        return []

    return [
        {
            "title": str(item.get("title", "")),
            "url": str(item.get("url", "")),
            "snippet": str(item.get("content", "")),
        }
        for item in response_data.get("results", [])[:max_results]
    ]


def web_search(query: str, max_results: int = 5) -> str:
    """Search current web information and return Markdown-formatted results."""
    normalized_query = query.strip()
    if not normalized_query:
        return "Câu truy vấn tìm kiếm không được để trống."

    result_limit = max(1, min(max_results, _MAX_RESULTS_LIMIT))
    logger.info(f"Searching the web for: {normalized_query!r}")

    results: List[SearchResult] = []
    if settings.TAVILY_API_KEY:
        results = _search_tavily(
            normalized_query,
            settings.TAVILY_API_KEY,
            result_limit,
        )
    if not results:
        results = _search_duckduckgo(normalized_query, result_limit)

    if not results:
        return f"Không tìm thấy kết quả phù hợp cho: '{normalized_query}'."

    output = [f"### Kết quả tìm kiếm cho: '{normalized_query}'"]
    for index, result in enumerate(results, start=1):
        output.append(
            f"**{index}. [{result['title']}]({result['url']})**\n"
            f"- Trích dẫn: {result['snippet']}\n"
            f"- Link: {result['url']}"
        )
    return "\n\n".join(output)
