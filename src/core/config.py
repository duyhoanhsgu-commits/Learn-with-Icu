import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Learn with Icu RAG API"
    VERSION: str = "0.1.0"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # PostgreSQL Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "rag_db"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rag_db"

    # Vector Store
    VECTOR_STORE_TYPE: str = "qdrant"  # "qdrant" or "pgvector"
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION_NAME: str = "rag_documents"

    # Object Storage
    STORAGE_TYPE: str = "local"  # "local" or "s3"
    UPLOAD_DIR: str = "./uploads"

    # Embeddings & LLM
    EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536
    LLM_MODEL_NAME: str = "gpt-4o-mini"
    OPENAI_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def absolute_upload_dir(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path.resolve()


settings = Settings()
