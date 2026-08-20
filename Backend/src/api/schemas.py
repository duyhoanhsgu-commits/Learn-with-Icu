from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    meta_info: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    total: int
    documents: List[DocumentResponse]


class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse


# --- Chat Schemas ---
class ChatQueryRequest(BaseModel):
    question: str = Field(..., description="User query / question")
    session_id: Optional[str] = Field(default="default_session", description="Chat session identifier")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of context chunks to retrieve")
    score_threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum similarity score")
    stream: bool = Field(default=False, description="Stream response tokens")


class SourceChunk(BaseModel):
    chunk_id: Optional[str] = None
    score: float
    text: str
    source: str
    document_id: Optional[str] = None
    chunk_index: Optional[int] = None


class ChatQueryResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    sources: List[SourceChunk]
