from typing import Dict, Any
from pathlib import Path


class MetadataExtractor:
    """Extracts and normalizes metadata for ingested documents."""

    @staticmethod
    def extract_metadata(file_path: Path, extra_info: Dict[str, Any] = None) -> Dict[str, Any]:
        metadata = {
            "source": str(file_path.name),
            "file_extension": file_path.suffix.lower(),
            "path": str(file_path),
        }
        if extra_info:
            metadata.update(extra_info)
        return metadata
