"""
Workers package initialization.
"""
from src.workers.ingestion_worker import process_document_background

__all__ = ["process_document_background"]
