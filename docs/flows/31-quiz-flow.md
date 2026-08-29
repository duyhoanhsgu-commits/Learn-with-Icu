# Flow 31 — Quiz

```mermaid
sequenceDiagram
    actor U
    participant UI as ToolsPanel
    participant API as POST /tools/quiz
    participant R as Retriever
    participant L as LLM
    participant DB as LearningTool
    U->>UI: Chọn Quiz, sửa prompt, Generate
    UI->>API: space_id + prompt
    API->>DB: Kiểm tra space
    API->>R: Retrieve top 12, threshold 0, space filter
    R-->>API: document contexts
    API->>L: Strict JSON, đúng N questions
    L-->>API: title + questions
    API->>API: Pydantic validate 4 options/correct_index
    API->>DB: Persist content JSON
    API-->>UI: QuizResponse
    UI->>UI: Thêm saved list / mở QuizPlayer
```

## Số câu

Parser đọc số trong prompt tiếng Anh/Việt; mặc định 10, clamp 1–30. LLM phải trả đúng số, nếu không API trả lỗi generation.

## Grounding

Prompt bắt buộc chỉ dùng context retrieved, tránh trick question và phủ nhiều concept. Không có context → 400; không có API key/provider/structure sai → 502.

## UI lifecycle

Prompts tùy chỉnh lưu `localStorage`. ToolsPanel load saved quiz khi đổi space, có thể mở player hoặc xóa tool. Quiz answer/progress trong player là UI state; cấu trúc quiz gốc được lưu backend.

## Code liên quan

- `backend/src/agent/tools/quiz_generator.py`
- `backend/src/api/routes/tools.py`
- `frontend/src/components/workspace/ToolsPanel.jsx`
- `frontend/src/components/workspace/QuizPlayer.jsx`

