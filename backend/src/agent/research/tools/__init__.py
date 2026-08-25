"""Research-facing aliases for the project's existing safe web tools."""

from src.agent.tools.web_fetch import fetch_url
from src.agent.tools.web_search import search_results

__all__ = ["fetch_url", "search_results"]
