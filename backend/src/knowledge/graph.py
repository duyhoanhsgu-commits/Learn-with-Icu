from dataclasses import dataclass
from typing import Any, Iterable


def _value(item: Any, key: str, default=None):
    return item.get(key, default) if isinstance(item, dict) else getattr(item, key, default)


@dataclass(frozen=True)
class GraphConcept:
    id: str
    space_id: str
    name: str
    summary: str = ""
    difficulty: int = 1


@dataclass(frozen=True)
class GraphEdge:
    source: str
    target: str
    relation: str


class KnowledgeGraph:
    """Small in-memory view used for deterministic, testable traversal."""

    def __init__(self, concepts: Iterable[Any], edges: Iterable[Any], space_id: str):
        self.space_id = space_id
        self.concepts = {
            str(_value(item, "id")): GraphConcept(
                id=str(_value(item, "id")),
                space_id=str(_value(item, "space_id")),
                name=str(_value(item, "name")),
                summary=str(_value(item, "summary", "")),
                difficulty=int(_value(item, "difficulty", 1)),
            )
            for item in concepts
            if str(_value(item, "space_id")) == space_id
        }
        self.edges = [
            GraphEdge(
                source=str(_value(item, "source_concept_id", _value(item, "source"))),
                target=str(_value(item, "target_concept_id", _value(item, "target"))),
                relation=str(_value(item, "relation")),
            )
            for item in edges
            if str(_value(item, "space_id", space_id)) == space_id
            and str(_value(item, "source_concept_id", _value(item, "source"))) in self.concepts
            and str(_value(item, "target_concept_id", _value(item, "target"))) in self.concepts
        ]

    def prerequisites(self, concept_id: str) -> list[GraphConcept]:
        ids = {
            edge.source
            for edge in self.edges
            if edge.relation == "prerequisite_of" and edge.target == concept_id
        }
        return [self.concepts[item_id] for item_id in ids if item_id in self.concepts]

    def next_concepts(self, concept_id: str) -> list[GraphConcept]:
        ids = {
            edge.target
            for edge in self.edges
            if edge.relation == "prerequisite_of" and edge.source == concept_id
        }
        return [self.concepts[item_id] for item_id in ids if item_id in self.concepts]

    def related(self, concept_id: str) -> list[GraphConcept]:
        ids: set[str] = set()
        for edge in self.edges:
            if edge.source == concept_id:
                ids.add(edge.target)
            if edge.target == concept_id:
                ids.add(edge.source)
        return [self.concepts[item_id] for item_id in ids if item_id in self.concepts]
