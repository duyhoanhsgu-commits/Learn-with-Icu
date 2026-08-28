from dataclasses import dataclass


def clamp01(value: float) -> float:
    return min(1.0, max(0.0, float(value)))


def mastery_status(mastery: float) -> str:
    value = clamp01(mastery)
    if value < 0.30:
        return "unknown"
    if value < 0.60:
        return "learning"
    if value < 0.80:
        return "familiar"
    return "mastered"


@dataclass(frozen=True)
class MasteryUpdate:
    mastery: float
    confidence: float
    correct_delta: int
    wrong_delta: int
    evidence_score: float


def update_mastery(
    previous_mastery: float,
    previous_confidence: float,
    *,
    correctness: float,
    completeness: float,
    understanding: float,
) -> MasteryUpdate:
    """Conservative evidence update; one answer can never jump directly to mastery."""
    previous = clamp01(previous_mastery)
    confidence = clamp01(previous_confidence)
    evidence = clamp01(
        0.50 * clamp01(correctness)
        + 0.20 * clamp01(completeness)
        + 0.30 * clamp01(understanding)
    )
    learning_rate = 0.14 if evidence >= previous else 0.20
    updated = clamp01(previous + learning_rate * (evidence - previous))
    updated_confidence = clamp01(confidence + 0.12 * (1.0 - confidence))
    correct = int(evidence >= 0.65)
    wrong = int(evidence < 0.65)
    return MasteryUpdate(
        mastery=round(updated, 4),
        confidence=round(updated_confidence, 4),
        correct_delta=correct,
        wrong_delta=wrong,
        evidence_score=round(evidence, 4),
    )


def apply_self_report(previous_mastery: float, previous_confidence: float) -> MasteryUpdate:
    """Self-report only nudges confidence; it never raises mastery."""
    return MasteryUpdate(
        mastery=clamp01(previous_mastery),
        confidence=round(clamp01(previous_confidence) + 0.03 * (1 - clamp01(previous_confidence)), 4),
        correct_delta=0,
        wrong_delta=0,
        evidence_score=clamp01(previous_mastery),
    )


def apply_struggle_report(previous_mastery: float, previous_confidence: float) -> MasteryUpdate:
    """Record uncertainty without treating a self-report as scored evidence."""
    return MasteryUpdate(
        mastery=clamp01(previous_mastery),
        confidence=round(clamp01(previous_confidence) * 0.90, 4),
        correct_delta=0,
        wrong_delta=0,
        evidence_score=clamp01(previous_mastery),
    )
