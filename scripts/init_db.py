import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
root_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_path))

from src.storage.postgres import init_db
from src.storage.vector_store import vector_store
from src.core.logging import setup_logging, logger


async def main():
    setup_logging(debug=True)
    logger.info("Initializing Database and Vector Store Collections...")

    try:
        await init_db()
        logger.info("PostgreSQL tables created successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

    try:
        await vector_store.ensure_collection()
        logger.info("Vector store collection initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize vector store: {e}")


if __name__ == "__main__":
    asyncio.run(main())
