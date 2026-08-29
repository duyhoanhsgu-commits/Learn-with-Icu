# Flow 07 — Mô hình dữ liệu và nơi lưu trữ

```mermaid
erDiagram
    LEARNING_SPACES ||--o{ DOCUMENTS : contains
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : split_into
    LEARNING_SPACES ||--o{ CONCEPTS : owns
    CONCEPTS ||--o{ CONCEPT_SOURCES : grounded_by
    DOCUMENT_CHUNKS ||--o{ CONCEPT_SOURCES : supports
    CONCEPTS ||--o{ CONCEPT_EDGES : source_or_target
    LEARNING_SPACES ||--o{ LEARNER_CONCEPTS : scopes
    CONCEPTS ||--o{ LEARNER_CONCEPTS : tracked_as
    LEARNING_SPACES ||--o{ LONG_TERM_MEMORIES : has
    LEARNING_SPACES ||--o{ LEARNING_TOOLS : has
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : contains
    LEARNING_SPACES o|--o{ CHAT_MESSAGES : scopes
    USERS ||--o{ GLOBAL_LONG_TERM_MEMORIES : owns
```

## PostgreSQL

| Bảng | Vai trò chính |
|---|---|
| `learning_spaces` | Boundary của bộ tài liệu và học tập; giữ `fixed_context` |
| `documents` | Metadata file và trạng thái ingestion |
| `document_chunks` | Text chunk dùng lexical search và source linking |
| `chat_conversations` | Title, summary, boundary compaction, clear timestamp |
| `chat_messages` | User/assistant content, sources JSON, token và excluded state |
| `long_term_memories` | Memory chỉ trong một space |
| `global_long_term_memories` | Profile dùng toàn hệ thống |
| `learning_tools` | JSON của quiz/mindmap/flashcards |
| `concepts`, `concept_edges`, `concept_sources` | Knowledge graph có grounding |
| `learner_concepts` | Mastery, confidence, counters, pending assessment |

## Qdrant

Một point cho mỗi document chunk: embedding vector + payload source/document/space/chunk/text/metadata. Search dùng cosine và filter `space_id`.

## Object store

File upload nguyên bản được lưu local dưới `UPLOAD_DIR`; PostgreSQL chỉ giữ đường dẫn.

## Frontend localStorage

- Width/collapse của learning workspace.
- Width sidebar và artifact panel ICU Tutor.
- Prompt tùy chỉnh cho Quiz/Mind map/Flashcards.

## Code liên quan

- `backend/src/storage/postgres.py`, `vector_store.py`, `object_store.py`
- `backend/src/knowledge/models.py`
- `backend/src/learner/models.py`

