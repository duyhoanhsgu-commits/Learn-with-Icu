# Flow 17 — Multi-query retrieval

```mermaid
sequenceDiagram
    participant Q as Original query
    participant P as QueryPlanner
    participant R as Retriever
    participant QD as Qdrant
    P->>P: Detect comparison/multipart
    P-->>Q: 1..4 planned queries
    par query 1
        R->>QD: search top min(top_k,3)
    and query 2
        R->>QD: search top min(top_k,3)
    and query N
        R->>QD: search top min(top_k,3)
    end
    R->>R: Merge theo chunk_id
    R->>R: Giữ bản có score cao nhất
    R->>R: Sort giảm dần và cắt top_k
```

## Khi được kích hoạt

Query planner nhận diện câu nhiều phần hoặc yêu cầu so sánh. Query đơn giản không chịu overhead này.

## Mục đích

- Tăng recall cho câu chứa nhiều khía cạnh.
- Tránh một embedding duy nhất làm mờ các vế.
- Giữ tổng context bounded nhờ giới hạn query và top result.

## Ranh giới

- Tối đa 4 subquery.
- Mỗi subquery lấy tối đa 3 khi complex.
- Deduplicate bằng chunk ID, không lặp cùng đoạn trong prompt.
- Đây khác Deep Research query rewrite: RAG planner nhẹ hơn, chỉ phục vụ một lượt retrieval.

## Code liên quan

- `backend/src/rag/query_planner.py`
- `backend/src/rag/pipeline.py`
- `backend/src/rag/retriever.py`

