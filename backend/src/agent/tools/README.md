# Agent tools

Đặt các tool mà agent có thể gọi trong thư mục này.

Mỗi tool nên:

- có tên và mô tả rõ ràng để agent chọn đúng lúc;
- khai báo input/output có kiểu cụ thể;
- tách logic nghiệp vụ khỏi phần đăng ký tool;
- xử lý lỗi thành kết quả dễ hiểu thay vì làm agent bị dừng;
- có kiểm thử tương ứng trong `tests/`.

Sau khi tạo tool, đăng ký nó vào graph hoặc node phù hợp trong
`backend/src/agent/` để agent thực sự có thể gọi được.
