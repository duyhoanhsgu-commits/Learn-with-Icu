from src.knowledge.graph import KnowledgeGraph


def concepts():
    return [
        {"id": "a", "space_id": "space-a", "name": "Vector", "difficulty": 1},
        {"id": "b", "space_id": "space-a", "name": "Embedding", "difficulty": 2},
        {"id": "c", "space_id": "space-b", "name": "Private concept", "difficulty": 1},
    ]


def edges():
    return [
        {"space_id": "space-a", "source": "a", "target": "b", "relation": "prerequisite_of"},
        {"space_id": "space-b", "source": "c", "target": "b", "relation": "related_to"},
    ]


def test_graph_builds_and_traverses_prerequisites():
    graph = KnowledgeGraph(concepts(), edges(), "space-a")

    assert [item.id for item in graph.prerequisites("b")] == ["a"]
    assert [item.id for item in graph.next_concepts("a")] == ["b"]


def test_graph_enforces_space_isolation():
    graph = KnowledgeGraph(concepts(), edges(), "space-a")

    assert "c" not in graph.concepts
    assert all(edge.source != "c" and edge.target != "c" for edge in graph.edges)

