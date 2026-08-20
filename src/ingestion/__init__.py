"""
Ingestion package initialization.
"""
from src.ingestion.parser import DocumentParser
from src.ingestion.chunker import TextChunker
from src.ingestion.metadata import MetadataExtractor
from src.ingestion.pipeline import IngestionPipeline

__all__ = [
    "DocumentParser",
    "TextChunker",
    "MetadataExtractor",
    "IngestionPipeline",
]
