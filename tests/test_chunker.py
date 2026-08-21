from src.ingestion.chunker import TextChunker


def test_chunks_are_token_bounded_and_overlapping():
    chunker = TextChunker(chunk_size=50, chunk_overlap=10)
    text = " ".join(f"token{i}" for i in range(300))
    chunks = chunker.split_text(text)

    assert len(chunks) > 1
    assert all(chunker.token_count(chunk) <= 50 for chunk in chunks)
    for previous, current in zip(chunks, chunks[1:]):
        previous_tokens = chunker.encoding.encode(previous)
        current_tokens = chunker.encoding.encode(current)
        assert previous_tokens[-10:] == current_tokens[:10]


def test_short_paragraphs_stay_intact():
    chunker = TextChunker(chunk_size=30, chunk_overlap=5)
    paragraphs = [
        "First paragraph contains one complete idea.",
        "Second paragraph contains another complete idea.",
        "Third paragraph closes the section clearly.",
    ]
    chunks = chunker.split_text("\n\n".join(paragraphs))

    assert all(any(paragraph in chunk for chunk in chunks) for paragraph in paragraphs)


def test_default_configuration_is_500_with_75_overlap():
    chunker = TextChunker()
    assert chunker.chunk_size == 500
    assert chunker.chunk_overlap == 75
