# RAG System Architecture & Backend

High-performance modular Retrieval-Augmented Generation (RAG) backend constructed using FastAPI, PostgreSQL, Qdrant/pgvector, and OpenAI.

## Project Structure

```
.
├── src/
│   ├── api/
│   │   ├── main.py            # FastAPI Application Entrypoint
│   │   ├── schemas.py         # Pydantic schemas for Request/Response
│   │   └── routes/
│   │       ├── documents.py   # Upload, List, Get, Delete document endpoints
│   │       └── chat.py        # Q&A / Chat endpoints (Standard + Streaming)
│   │
│   ├── ingestion/
│   │   ├── parser.py          # PDF / TXT / MD / JSON file parsers
│   │   ├── chunker.py         # Text chunking logic
│   │   ├── metadata.py        # Metadata extraction
│   │   └── pipeline.py        # Full ingestion workflow
│   │
│   ├── rag/
│   │   ├── retriever.py       # Context retrieval logic
│   │   ├── generator.py       # LLM response generation
│   │   └── pipeline.py        # Complete RAG query pipeline
│   │
│   ├── embeddings/
│   │   └── service.py         # Embedding service (OpenAI / Fallback)
│   │
│   ├── storage/
│   │   ├── postgres.py        # User, document, and chat metadata (SQLAlchemy)
│   │   ├── vector_store.py    # Qdrant / pgvector store manager
│   │   └── object_store.py    # Local file storage (S3 ready)
│   │
│   ├── workers/
│   │   └── ingestion_worker.py# Async upload processing background worker
│   │
│   └── core/
│       ├── config.py          # Environment settings
│       └── logging.py         # Loguru logger setup
│
├── scripts/
│   └── init_db.py             # Database & collection initialization script
│
├── tests/                     # Unit and integration tests
├── uploads/                   # Local uploads directory
├── docker-compose.yml         # Postgres & Qdrant Docker services
├── pyproject.toml             # Project dependencies and packaging
└── .env                       # Environment variables configuration
```

## Quick Start

Run the backend, frontend, PostgreSQL, and Qdrant together:

```bash
./dev.sh
```

Press `Ctrl+C` to stop the backend and frontend. To use database services that are
already running outside Docker, run `SKIP_DOCKER=1 ./dev.sh`.

### 1. Start Database Services

```bash
docker-compose up -d
```

### 2. Install Dependencies & Initialize Database

```bash
pip install -e .
python scripts/init_db.py
```

### 3. Run FastAPI Dev Server

```bash
PYTHONPATH=backend uvicorn src.api.main:app --reload --port 8000
```

Access API Documentation at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to
FastAPI on port `8000`. For a deployed backend, copy `frontend/.env.example` to
`frontend/.env` and set `VITE_API_URL` to the public `/api/v1` URL.

Learning spaces are persisted by the backend. Every upload includes a `space_id`,
and chat requests made inside a space are filtered by that same ID in Qdrant.
Documents created before this model was introduced are migrated into an
`Imported documents` space on startup.

`POST /api/v1/chat/general` is plain LLM chat without retrieval.
`POST /api/v1/chat/query` requires `space_id` and runs space-scoped RAG.
