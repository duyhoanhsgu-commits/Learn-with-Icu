"""
API routes package initialization.
"""
from src.api.routes.documents import router as documents_router
from src.api.routes.chat import router as chat_router

__all__ = ["documents_router", "chat_router"]
