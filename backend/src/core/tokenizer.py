import hashlib
import os
import tempfile
from pathlib import Path

import tiktoken

_ENCODING_URLS = {
    "cl100k_base": "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
    "o200k_base": "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken",
    "p50k_base": "https://openaipublic.blob.core.windows.net/encodings/p50k_base.tiktoken",
    "r50k_base": "https://openaipublic.blob.core.windows.net/encodings/r50k_base.tiktoken",
}


def cached_model_encoding(model_name: str):
    """Return a tiktoken encoding without triggering a network call during import."""
    try:
        encoding_name = tiktoken.model.encoding_name_for_model(model_name)
    except KeyError:
        encoding_name = "cl100k_base"

    allow_download = os.getenv("TIKTOKEN_ALLOW_DOWNLOAD", "").casefold() in {
        "1", "true", "yes",
    }
    cache_dir = Path(
        os.getenv("TIKTOKEN_CACHE_DIR", Path(tempfile.gettempdir()) / "data-gym-cache")
    )
    source_url = _ENCODING_URLS.get(encoding_name)
    cache_file = (
        cache_dir / hashlib.sha1(source_url.encode()).hexdigest()
        if source_url else None
    )
    if not allow_download and (cache_file is None or not cache_file.exists()):
        return None
    try:
        return tiktoken.get_encoding(encoding_name)
    except Exception:
        return None
