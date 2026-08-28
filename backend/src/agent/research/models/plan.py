from typing import Literal

from pydantic import BaseModel, Field, field_validator


ResearchQuestionType = Literal[
    "background",
    "mechanism",
    "architecture",
    "evidence",
    "comparison",
    "limitation",
    "criticism",
    "application",
    "current_state",
]


class QueryUnderstanding(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    intent: str = Field(default="deep_research", min_length=1, max_length=80)
    depth: Literal["brief", "standard", "deep"] = "deep"
    entities: list[str] = Field(default_factory=list, max_length=12)
    constraints: list[str] = Field(default_factory=list, max_length=12)
    needs_fresh_information: bool = False
    use_local_sources: bool = True
    use_web_sources: bool = True

    @field_validator("topic", "intent")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split()).strip()

    @field_validator("entities", "constraints")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = " ".join(value.split()).strip()
            key = normalized.casefold()
            if normalized and key not in seen:
                result.append(normalized)
                seen.add(key)
        return result[:12]


class ResearchQuestion(BaseModel):
    id: str = Field(pattern=r"^rq_[1-9][0-9]*$")
    question: str = Field(min_length=1, max_length=500)
    type: ResearchQuestionType = "evidence"
    priority: int = Field(default=3, ge=1, le=5)
    search_query: str = Field(min_length=1, max_length=500)

    @field_validator("question", "search_query")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split()).strip()
