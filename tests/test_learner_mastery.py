from src.learner.mastery import (
    apply_self_report,
    apply_struggle_report,
    mastery_status,
    update_mastery,
)


def test_mastery_update_is_conservative():
    first = update_mastery(
        0.0,
        0.0,
        correctness=1.0,
        completeness=1.0,
        understanding=1.0,
    )

    assert 0 < first.mastery < 0.30
    assert first.correct_delta == 1
    assert mastery_status(first.mastery) == "unknown"


def test_wrong_evidence_reduces_mastery_and_self_report_does_not_raise_it():
    wrong = update_mastery(
        0.70,
        0.80,
        correctness=0.1,
        completeness=0.2,
        understanding=0.1,
    )
    report = apply_self_report(0.45, 0.50)

    assert wrong.mastery < 0.70
    assert wrong.wrong_delta == 1
    assert report.mastery == 0.45
    assert report.confidence > 0.50


def test_struggle_report_preserves_mastery_and_lowers_confidence():
    result = apply_struggle_report(0.55, 0.8)

    assert result.mastery == 0.55
    assert result.confidence == 0.72
    assert result.wrong_delta == 0
