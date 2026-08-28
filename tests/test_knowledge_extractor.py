from types import SimpleNamespace

import pytest

from src.knowledge.extractor import ConceptExtractor


def test_concept_extraction_parses_sources_and_supported_relations():
    result = ConceptExtractor.parse(
        """```json
        {
          "concepts": [
            {"name": "Embedding", "summary": "Dense vector", "difficulty": 2,
             "source_chunk_ids": ["chunk-1", "foreign"]},
            {"name": "Semantic Search", "summary": "Meaning based search", "difficulty": 3,
             "source_chunk_ids": ["chunk-2"]}
          ],
          "relations": [
            {"source": "Embedding", "target": "Semantic Search", "relation": "prerequisite_of"},
            {"source": "Embedding", "target": "Semantic Search", "relation": "invalid"}
          ]
        }
        ```""",
        {"chunk-1", "chunk-2"},
    )

    assert [item.name for item in result.concepts] == ["Embedding", "Semantic Search"]
    assert result.concepts[0].source_chunk_ids == ["chunk-1"]
    assert len(result.relations) == 1
    assert result.relations[0].relation == "prerequisite_of"


class FakeCompletions:
    def __init__(self):
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        content = (
            '{"concepts":[{"name":"Vector","summary":"Magnitude and direction",'
            '"difficulty":1,"source_chunk_ids":["chunk-1"]}],"relations":[]}'
        )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )


@pytest.mark.asyncio
async def test_concept_extractor_uses_structured_llm_output():
    completions = FakeCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    result = await ConceptExtractor(client=client).extract([
        {"id": "chunk-1", "content": "A vector has magnitude and direction."}
    ])

    assert result.concepts[0].name == "Vector"
    assert completions.calls[0]["response_format"] == {"type": "json_object"}

