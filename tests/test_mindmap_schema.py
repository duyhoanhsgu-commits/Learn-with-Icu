import pytest
from pydantic import ValidationError

from src.api.schemas import MindMapNode


def test_mindmap_node_accepts_nested_branches():
    root = MindMapNode.model_validate({
        "label": "RAG",
        "description": "Retrieval-augmented generation",
        "children": [{"label": "Retrieval", "children": []}],
    })

    assert root.children[0].label == "Retrieval"


def test_mindmap_node_rejects_empty_labels():
    with pytest.raises(ValidationError):
        MindMapNode.model_validate({"label": "", "children": []})
