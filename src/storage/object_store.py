import shutil
from pathlib import Path
from typing import BinaryIO, Optional
from src.core.config import settings
from src.core.logging import logger


class ObjectStore:
    """
    Object Storage Manager.
    Currently manages local storage with interface ready for S3/MinIO migration.
    """

    def __init__(self, upload_dir: Optional[Path] = None):
        self.upload_dir = upload_dir or settings.absolute_upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, file_obj: BinaryIO, filename: str) -> Path:
        """Save an uploaded file to storage."""
        target_path = self.upload_dir / filename
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        logger.info(f"Saved file to object store: {target_path}")
        return target_path

    def get_file_path(self, filename: str) -> Path:
        """Get absolute path of a stored file."""
        return self.upload_dir / filename

    def delete_file(self, filename: str) -> bool:
        """Delete a file from object store."""
        target_path = self.upload_dir / filename
        if target_path.exists():
            target_path.unlink()
            logger.info(f"Deleted file from object store: {target_path}")
            return True
        return False

    def exists(self, filename: str) -> bool:
        """Check if file exists in object store."""
        return (self.upload_dir / filename).exists()


object_store = ObjectStore()
