# Flow 04 — Upload tài liệu từ UI

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant UI as LearnPage
    participant API as POST /documents/upload
    participant FS as Object store
    participant PG as PostgreSQL
    participant BG as BackgroundTasks
    U->>UI: Chọn/kéo file
    UI->>UI: Thêm temporary file: uploading
    UI->>API: multipart file + space_id
    API->>PG: Kiểm tra space
    API->>API: Validate extension
    API->>FS: save_file với tên duy nhất
    API->>PG: Insert Document(status=pending)
    API->>BG: enqueue process_document
    API-->>UI: 201 + document
    UI->>UI: Thay temporary bằng persisted file
    loop tối đa 30 lần, mỗi 1 giây
        UI->>API: GET /documents/{id}
        API-->>UI: pending / processing / completed / failed
    end
```

## Quy tắc

- Space phải tồn tại.
- Loại file được parser hỗ trợ: PDF, TXT, Markdown, DOCX, JSON.
- File UI tạm thời bị xóa nếu upload API thất bại.
- Sau 30 lần poll, UI dừng tự hỏi trạng thái; backend có thể vẫn xử lý tiếp.
- Khi `completed`, UI đổi status thành `ready` và thêm assistant notification vào space.

## Dữ liệu tạo ban đầu

`Document`: ID, `space_id`, filename gốc, file type, size, đường dẫn object store, status `pending`, chunk count ban đầu.

## Code liên quan

- `frontend/src/pages/LearnPage.jsx`: `upload`, `pollDocument`
- `frontend/src/api/documents.js`
- `backend/src/api/routes/documents.py`
- `backend/src/storage/object_store.py`

