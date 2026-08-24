"""Tools callable by the learning agent."""

from src.agent.tools.web_fetch import fetch_url
from src.agent.tools.web_search import search_results, web_search
from src.agent.tools.flashcard_generator import extract_card_count, generate_flashcards
from src.agent.tools.mindmap_generator import generate_mindmap
from src.agent.tools.quiz_generator import extract_question_count, generate_quiz

__all__ = [
    "extract_question_count",
    "extract_card_count",
    "fetch_url",
    "generate_mindmap",
    "generate_flashcards",
    "generate_quiz",
    "search_results",
    "web_search",
]
