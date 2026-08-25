from src.rag.generator import RAGGenerator


def test_rag_system_prompt_requires_minimal_inline_citations():
    prompt = RAGGenerator._build_rag_system_prompt()

    assert "at the end of the sentence or list item" in prompt
    assert "[1](#source-1)" in prompt
    assert "exactly one citation when one context is enough" in prompt
    assert "multiple citations only" in prompt
    assert "do not add a separate Sources or References section" in prompt


def test_custom_rag_role_keeps_citation_rules():
    prompt = RAGGenerator._build_rag_system_prompt("Summarize faithfully.")

    assert prompt.startswith("Summarize faithfully.")
    assert "[1](#source-1)" in prompt
