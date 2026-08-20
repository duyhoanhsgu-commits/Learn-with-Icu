import json
from pathlib import Path
from typing import Dict, Any, Tuple
from pypdf import PdfReader

from src.core.logging import logger


class DocumentParser:
    """Parser for converting various file formats (PDF, TXT, MD, JSON) into clean text."""

    @staticmethod
    def parse_file(file_path: Path) -> Tuple[str, Dict[str, Any]]:
        """Parse file content and return extracted text with parsed metadata."""
        suffix = file_path.suffix.lower()
        metadata: Dict[str, Any] = {
            "extension": suffix,
            "filename": file_path.name,
            "size_bytes": file_path.stat().st_size if file_path.exists() else 0,
        }

        if suffix == ".pdf":
            return DocumentParser._parse_pdf(file_path, metadata)
        elif suffix in [".txt", ".md", ".markdown"]:
            return DocumentParser._parse_text(file_path, metadata)
        elif suffix == ".json":
            return DocumentParser._parse_json(file_path, metadata)
        else:
            # Fallback text reading
            return DocumentParser._parse_text(file_path, metadata)

    @staticmethod
    def _parse_pdf(file_path: Path, metadata: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        text_content = []
        try:
            reader = PdfReader(str(file_path))
            metadata["total_pages"] = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                extracted = page.extract_text()
                if extracted:
                    text_content.append(extracted)
            logger.info(f"Successfully parsed PDF: {file_path.name} ({len(reader.pages)} pages)")
        except Exception as e:
            logger.error(f"Failed to parse PDF {file_path}: {e}")
            raise ValueError(f"Could not parse PDF file: {e}")

        return "\n\n".join(text_content), metadata

    @staticmethod
    def _parse_text(file_path: Path, metadata: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            metadata["line_count"] = len(content.splitlines())
            return content, metadata
        except Exception as e:
            logger.error(f"Failed to parse text file {file_path}: {e}")
            raise ValueError(f"Could not parse text file: {e}")

    @staticmethod
    def _parse_json(file_path: Path, metadata: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if isinstance(data, str):
                content = data
            else:
                content = json.dumps(data, indent=2, ensure_ascii=False)

            metadata["json_keys"] = list(data.keys()) if isinstance(data, dict) else []
            return content, metadata
        except Exception as e:
            logger.error(f"Failed to parse JSON file {file_path}: {e}")
            raise ValueError(f"Could not parse JSON file: {e}")
