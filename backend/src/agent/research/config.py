"""Central cost and retrieval bounds for the Research Agent."""

from dataclasses import dataclass

from src.agent.context.builder import CONTEXT_WINDOW_TOKEN_LIMIT


@dataclass(frozen=True)
class ResearchSettings:
    max_output_tokens: int = 12_000
    min_questions: int = 3
    max_questions: int = 6
    max_query_variants: int = 3
    vector_candidate_k: int = 12
    lexical_candidate_k: int = 12
    lexical_scan_limit: int = 240
    rerank_top_k: int = 4
    max_web_results_per_query: int = 5
    max_web_sources: int = 10
    follow_up_source_reserve: int = 3


research_settings = ResearchSettings()
RESEARCH_INPUT_TOKEN_BUDGET = (
    CONTEXT_WINDOW_TOKEN_LIMIT - research_settings.max_output_tokens
)
