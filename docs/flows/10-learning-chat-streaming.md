# Flow 10 — Learning Chat streaming

```mermaid
sequenceDiagram
    actor U
    participant UI as LearnPage
    participant API as /chat/stream
    participant Router
    participant Node as RAG/Tutor/Research/Summary
    participant PG
    U->>UI: Hỏi trong active space
    UI->>UI: Kiểm tra có indexed file
    UI->>UI: Lấy/tạo session_id cho space
    UI->>API: question + space_id + session_id + mode + image
    API->>Router: classify route
    Router->>Node: execute
    alt RAG direct streaming
        Node-->>UI: token SSE từ LLM
    else Research
        Node-->>UI: progress SSE
        Node-->>UI: word-stream final report
    else Tutor/other
        Node-->>API: full result
        API-->>UI: word-stream result
    end
    API->>PG: Persist exchange
    API-->>UI: done + sources + route/tutor metadata
```

## Guard phía frontend

Không gửi khi: không có active space, chưa có file `ready + persisted`, đang typing hoặc message rỗng.

## Session theo space

`sessionIdsRef` giữ một UUID cho mỗi space trong phiên browser. Reset conversation xóa UUID của space và thay message bằng opening message. Reload trang làm mất message/session map phía UI.

## Image/excerpt

- Text selection được nối vào question dưới nhãn `Selected document excerpt`.
- PDF capture gửi `image_data_url`; schema/backend truyền dữ liệu ảnh vào nhánh có hỗ trợ.

## Khác General Chat

- Không có sidebar conversation hay context meter trong Learning Workspace.
- Opening message là UI-only.
- Response vẫn được backend persist theo `session_id`, nhưng frontend hiện không có flow load lại lịch sử này.

## Code liên quan

- `frontend/src/pages/LearnPage.jsx`
- `frontend/src/api/chat.js`
- `backend/src/api/routes/chat.py`
- `backend/src/agent/graph.py`
