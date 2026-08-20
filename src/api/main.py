from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.logging import setup_logging, logger
from src.storage.postgres import init_db
from src.storage.vector_store import vector_store
from src.api.routes.documents import router as documents_router
from src.api.routes.chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifespan events."""
    setup_logging(debug=settings.DEBUG)
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    
    # Initialize DB tables
    try:
        await init_db()
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL DB on startup: {e}")

    # Ensure vector store collection exists
    try:
        await vector_store.ensure_collection()
    except Exception as e:
        logger.warning(f"Could not connect to VectorStore on startup: {e}")

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")


def create_app() -> FastAPI:
    """Factory to create FastAPI application instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routes
    app.include_router(documents_router, prefix=settings.API_V1_STR)
    app.include_router(chat_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "project": settings.PROJECT_NAME,
            "version": settings.VERSION,
        }

    return app


app = create_app()
