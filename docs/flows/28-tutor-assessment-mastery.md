# Flow 28 — Tutor assessment và cập nhật mastery

```mermaid
sequenceDiagram
    actor L as Learner
    participant T as TutorService
    participant R as Retriever
    participant G as Generator
    participant DB as LearnerRepository
    participant E as LearnerEvaluator
    T->>R: Retrieve context cho focus concept
    T->>G: Tạo đúng 1 assessment question
    T->>DB: Save pending_question + expected context
    T-->>L: Question, chưa đưa đáp án
    L->>T: Trả lời ở message kế tiếp
    T->>DB: Load latest pending assessment
    T->>E: question + expected + answer + previous mastery
    E-->>T: correctness/completeness/understanding/feedback
    T->>DB: Conservative mastery update + clear pending
    T-->>L: Feedback + mastery/status mới
```

## Công thức evidence

```text
evidence = 0.50*correctness + 0.20*completeness + 0.30*understanding
learning_rate = 0.14 nếu evidence >= previous, ngược lại 0.20
new = previous + learning_rate*(evidence-previous)
```

Một câu trả lời không thể nhảy thẳng từ 0 lên mastered. Confidence tăng dần 12% phần còn thiếu. Evidence ≥0.65 tăng correct count, thấp hơn tăng wrong count.

## Self-report

“Tôi đã biết/hiểu” chỉ tăng nhẹ confidence, không tăng mastery. Đây là guard chống mastery giả do tự khai.

## Provider unavailable

Nếu evaluator không dùng được, pending assessment được giữ, mastery không đổi và Tutor báo có thể resume sau.

## Trạng thái

- `<0.30 unknown`
- `<0.60 learning`
- `<0.80 familiar`
- `>=0.80 mastered`

## Code liên quan

- `backend/src/tutor/service.py`
- `backend/src/learner/evaluator.py`
- `backend/src/learner/mastery.py`
- `backend/src/learner/repository.py`

