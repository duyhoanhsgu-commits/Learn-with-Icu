# Flow 16 — RAG hỏi đáp tài liệu

```mermaid
flowchart TD
    Q[Question + space_id] --> P[Query planner]
    P --> T{Simple hay complex?}
    T -->|simple| E[Embedding query]
    T -->|multipart/comparison| MQ[Subqueries tối đa 4]
    MQ --> E2[Embedding từng subquery song song]
    E --> V[Qdrant cosine search]
    E2 --> V
    V --> F[Filter space_id + score threshold]
    F --> D[Deduplicate chunk ID, giữ score tốt nhất]
    D --> C[Build retrieved context]
    C --> L[LLM grounded generation]
    L --> A[Markdown answer + citations]
    D --> S[Sources response]
```

## Input

- Query, `space_id`, `top_k` mặc định 5, score threshold.
- Fixed context, relevant memories và recent history.

## Retrieval

Normal RAG là vector-first. Payload Qdrant cung cấp text/source/document/chunk/page. Search luôn có filter `space_id` từ Learning Chat.

## Generation

System prompt yêu cầu trả lời từ context, dùng Markdown, hỗ trợ math và trích nguồn. Nhánh direct RAG có thể stream token thật từ provider.

## Không có context

Generator phải nói không đủ evidence thay vì bịa từ tài liệu. Một số fallback kỹ thuật có thể trả message định trước khi LLM/provider không dùng được.

## Output

`answer`, `sources` và route metadata. Frontend map sources sang `fileId/chunkId/chunkIndex/page/url` để click mở.

## Code liên quan

- `backend/src/rag/pipeline.py`
- `backend/src/rag/retriever.py`
- `backend/src/rag/query_planner.py`
- `backend/src/rag/generator.py`

