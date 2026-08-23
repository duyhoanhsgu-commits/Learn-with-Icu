"""Tools callable by the learning agent."""

from src.agent.tools.web_fetch import fetch_url
from src.agent.tools.web_search import search_results, web_search
from src.agent.tools.quiz_generator import extract_question_count, generate_quiz

__all__ = ["extract_question_count", "fetch_url", "generate_quiz", "search_results", "web_search"]
