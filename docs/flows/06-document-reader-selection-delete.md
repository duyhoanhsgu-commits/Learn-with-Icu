# Flow 06 — Đọc, trích chọn và xóa tài liệu

## Mở tài liệu

```mermaid
flowchart TD
    A[Chọn file hoặc click citation] --> B[DocumentsPanel mở viewer]
    B --> C{File type}
    C -->|PDF| D[GET /documents/id/content]
    C -->|MD/TXT/DOCX/JSON text| E[GET /documents/id/text]
    D --> F[PDF.js render canvas từng trang]
    E --> G[Markdown hoặc plain text preview]
    H[Citation có chunk/page] --> I[Đặt sourceTarget]
    I --> B
    I --> J[Viewer cuộn tới nguồn nếu hỗ trợ]
```

## Hỏi từ vùng chọn

1. Với text, người dùng bôi đen; viewer lấy selection tối đa 3.000 ký tự.
2. Với PDF, chế độ Capture cho phép kéo vùng trên canvas.
3. Viewer crop canvas và tạo JPEG data URL chất lượng 0.85.
4. Popover nhận câu hỏi.
5. `LearnPage.send` gửi câu hỏi kèm excerpt hoặc `image_data_url` tới `/chat/stream`.

## Xóa document

```mermaid
sequenceDiagram
    participant UI
    participant API
    participant QD
    participant FS
    participant PG
    UI->>UI: Confirm
    UI->>API: DELETE /documents/{id}
    API->>QD: Xóa vectors theo document_id
    API->>FS: Xóa file vật lý
    API->>PG: Xóa Document
    PG-->>PG: Cascade chunks và concept_sources
    API-->>UI: 200
    UI->>UI: Loại file khỏi mọi space state
```

## Code liên quan

- `frontend/src/components/workspace/DocumentViewer.jsx`
- `frontend/src/components/workspace/DocumentsPanel.jsx`
- `frontend/src/pages/LearnPage.jsx`
- `backend/src/api/routes/documents.py`

