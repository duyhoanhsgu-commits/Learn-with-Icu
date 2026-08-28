import re
from enum import Enum


class TutorIntent(str, Enum):
    AUTO = "AUTO"
    TEACH = "TEACH"
    REVIEW = "REVIEW"
    STRUGGLE = "STRUGGLE"
    ASSESS = "ASSESS"
    DIAGNOSTIC = "DIAGNOSTIC"


_INTENT_PATTERNS = {
    TutorIntent.DIAGNOSTIC: (
        r"\bdiagnostic\b",
        r"\bassess my level\b",
        r"\bkiểm tra đầu vào\b",
        r"\bđánh giá trình độ\b",
    ),
    TutorIntent.ASSESS: (
        r"\bquiz me\b",
        r"\btest me\b",
        r"\bcheck my (?:knowledge|understanding)\b",
        r"\bassess my (?:knowledge|understanding)\b",
        r"\bask me (?:a |some )?questions?\b",
        r"\bkiểm tra (?:tôi|mình|kiến thức)\b",
        r"\bquiz (?:tôi|mình)\b",
        r"\bhỏi (?:tôi|mình) (?:một số |vài )?câu\b",
        r"\bra (?:một |vài )?câu hỏi\b",
    ),
    TutorIntent.STRUGGLE: (
        r"\b(?:i(?:'m| am) )?(?:stuck|confused|lost)\b",
        r"\b(?:i )?(?:do not|don't|dont|cannot|can't|cant) understand\b",
        r"\bhaving trouble (?:with|understanding)\b",
        r"\b(?:tôi|mình|em)?\s*(?:đang )?(?:bị )?(?:bí|kẹt)\b",
        r"\b(?:không|chưa) (?:hiểu|nắm|theo kịp)\b",
        r"\bkhó hiểu\b",
        r"\bmơ hồ\b",
    ),
    TutorIntent.REVIEW: (
        r"\breview (?:this|my|the)\b",
        r"\bôn (?:lại|tập)\b",
        r"\bgiải thích lại\b",
    ),
    TutorIntent.TEACH: (
        r"\bteach me\b",
        r"\bdạy (?:tôi|mình|em)\b",
        r"\bwhat should i learn next\b",
        r"\bnên học gì tiếp\b",
    ),
}


def detect_tutor_intent(message: str) -> TutorIntent:
    query = " ".join(message.casefold().split())
    for intent, patterns in _INTENT_PATTERNS.items():
        if any(re.search(pattern, query) for pattern in patterns):
            return intent
    return TutorIntent.AUTO


def is_explicit_tutor_request(message: str) -> bool:
    return detect_tutor_intent(message) != TutorIntent.AUTO
