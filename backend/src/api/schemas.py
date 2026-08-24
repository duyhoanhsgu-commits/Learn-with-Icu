from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# --- Document Schemas ---
class LearningSpaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    color: str = Field(default="blue", pattern="^(blue|teal|violet|amber)$")


class LearningSpaceResponse(BaseModel):
    id: str
    name: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: str
    space_id: str
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
class GeneralChatRequest(BaseModel):
    question: str = Field(..., description="User query / question")
    session_id: str = Field(default="default_session", description="Chat session identifier")


class ChatQueryRequest(GeneralChatRequest):
    space_id: str = Field(..., description="Learning space used to scope retrieval")
    image_data_url: Optional[str] = Field(
        default=None,
        max_length=8_000_000,
        pattern=r"^data:image/(png|jpeg|webp);base64,",
        description="Optional cropped document image as a data URL",
    )
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
    url: Optional[str] = None


class ChatQueryResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    sources: List[SourceChunk]


# --- Learning Tool Schemas ---
class LearningToolGenerateRequest(BaseModel):
    space_id: str
    prompt: str = Field(..., min_length=1, max_length=2000)


class QuizGenerateRequest(LearningToolGenerateRequest):
    pass


class QuizQuestion(BaseModel):
    question: str
    options: List[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    explanation: str


class QuizResponse(BaseModel):
    id: str
    title: str
    prompt: str
    question_count: int
    questions: List[QuizQuestion]
    space_id: Optional[str] = None
    created_at: Optional[datetime] = None


class MindMapNode(BaseModel):
    label: str = Field(..., min_length=1, max_length=160)
    description: str = Field(default="", max_length=500)
    children: List["MindMapNode"] = Field(default_factory=list, max_length=12)


class MindMapResponse(BaseModel):
    id: str
    title: str
    prompt: str
    root: MindMapNode
    space_id: Optional[str] = None
    created_at: Optional[datetime] = None


class Flashcard(BaseModel):
    front: str = Field(..., min_length=1, max_length=500)
    back: str = Field(..., min_length=1, max_length=1200)


class FlashcardSetResponse(BaseModel):
    id: str
    title: str
    prompt: str
    card_count: int
    cards: List[Flashcard]
    space_id: Optional[str] = None
    created_at: Optional[datetime] = None
