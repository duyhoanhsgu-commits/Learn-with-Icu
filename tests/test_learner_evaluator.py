from types import SimpleNamespace

import pytest

from src.learner.evaluator import EvaluationUnavailableError, LearnerEvaluator


def test_learner_evaluation_parsing_clamps_scores():
    result = LearnerEvaluator.parse(
        '```json\n{"correctness": 1.4, "completeness": 0.7, '
        '"understanding": -0.2, "feedback": "Grounded feedback"}\n```'
    )

    assert result.correctness == 1.0
    assert result.completeness == 0.7
    assert result.understanding == 0.0


@pytest.mark.asyncio
async def test_evaluator_grounds_mocked_llm_call_in_source_context():
    calls = []

    async def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
            content='{"correctness":0.8,"completeness":0.7,"understanding":0.75,"feedback":"Good"}'
        ))])

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    result = await LearnerEvaluator(client=client).evaluate(
        concept_name="Embedding",
        question="Explain embedding",
        expected_context="An embedding is a dense vector.",
        user_answer="It is a semantic vector.",
        previous_mastery=0.4,
    )

    assert result.understanding == 0.75
    assert "dense vector" in calls[0]["messages"][1]["content"]


@pytest.mark.asyncio
async def test_unavailable_evaluator_does_not_fabricate_evidence():
    evaluator = LearnerEvaluator()
    evaluator._client = None
    with pytest.raises(EvaluationUnavailableError):
        await evaluator.evaluate(
            concept_name="Embedding",
            question="Explain embedding",
            expected_context="Ground truth",
            user_answer="My answer",
            previous_mastery=0.4,
        )
