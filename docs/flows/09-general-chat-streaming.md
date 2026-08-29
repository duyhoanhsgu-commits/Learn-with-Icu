# Flow 09 — General Chat streaming

```mermaid
sequenceDiagram
    actor U
    participant UI as ChatPage
    participant API as /chat/general/stream
    participant MEM as Context + memory
    participant AG as Agent/Research
    participant LLM
    participant PG
    U->>UI: Enter message
    UI->>UI: Render user message + assistant placeholder
    alt chưa có conversation
        UI->>API: POST /chat/conversations
        API->>PG: Insert conversation
    end
    UI->>API: POST SSE, question/session_id/mode
    API->>MEM: history + global memory + context summary
    alt mode research
        API->>AG: Deep Research
        AG-->>UI: progress SSE
        AG-->>UI: token SSE của final report
    else auto
        API->>LLM: stream general response
        LLM-->>UI: token SSE liên tục
    end
    API->>PG: Persist user + assistant + sources
    API-->>UI: done SSE
    UI->>API: GET conversation detail
    API-->>UI: context meter/items
```

## SSE contract

- `token`: `{type, token}` để nối vào assistant content.
- `progress`: stage/message/current/total/status đã whitelist.
- `done`: answer, sources và metadata hoàn tất.
- `error`: message; client ném exception.

## UI behavior

- Không mở conversation cũ tự động khi vào trang; màn hình bắt đầu như New Chat.
- Suggested prompts chỉ hiện trước câu hỏi đầu tiên.
- Sau trả lời, title conversation lấy từ câu hỏi đầu, tối đa 72 ký tự.
- Nút Auto/Research truyền mode tới backend.
- Sau `done`, UI refresh context token/items; lỗi refresh không biến câu trả lời thành lỗi.

## Code liên quan

- `frontend/src/pages/ChatPage.jsx`
- `frontend/src/api/chat.js`
- `backend/src/api/routes/chat.py`
- `backend/src/rag/generator.py`

