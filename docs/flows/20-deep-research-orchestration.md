# Flow 20 — Deep Research orchestration tổng thể

```mermaid
flowchart TD
    A[ResearchState] --> U[1. Understand]
    U --> P[2. Plan 3–6 questions]
    P --> RW[3. Rewrite queries]
    RW --> PAR{4. Parallel retrieval}
    PAR --> WEB[Web search + read]
    PAR --> LOC[Local hybrid retrieval]
    WEB --> R[5. Rank sources]
    LOC --> R
    R --> X[6. Extract grounded evidence]
    X --> E[7. Evaluate coverage]
    E --> C{Enough evidence?}
    C -->|Có| S[9. Synthesize]
    C -->|Không và iteration < 3| F[8. Follow-up queries]
    F --> WEB
    C -->|Không query mới / đạt max| S
    S --> O[Report + source catalog]
```

## ResearchState mang theo

Query, space, fixed/memory/history, understanding, plan, query maps, searched queries, web/local/ranked sources, evidence, iteration, missing topics, report, sources và progress callback.

## Bound trung tâm

- Tối đa 3 iteration search.
- 3–6 research questions.
- Tối đa 3 query variants/question.
- Tối đa 10 web source tổng, chừa 3 slot cho follow-up.
- Local rerank top 4/question.
- Final output tối đa 12.000 tokens.

## Tính incremental

Mỗi node mutate cùng `ResearchState`. Source có cờ `extracted` để vòng sau chỉ extract nguồn mới. `searched_queries` ngăn search lặp vô hạn.

## Code liên quan

- `backend/src/agent/research/graph.py`
- `backend/src/agent/research/state.py`
- `backend/src/agent/research/config.py`
- `backend/src/agent/research/nodes/*`

