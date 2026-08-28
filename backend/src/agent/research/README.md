# Research Agent architecture

## Baseline retained from the existing repository

The original pipeline was already split into planner, web search, local vector
retrieval, grounded evidence extraction, coverage evaluation, bounded follow-up
search, and synthesis. URL canonicalization, source limits, verbatim excerpt
validation, Qdrant `space_id` filtering, progress events, and the three-iteration
guard remain authoritative behavior.

## Phase 1–2 extension

The pipeline now runs:

```text
understand -> structured plan -> query rewrite
           -> web search ----\
           -> local hybrid ---+-> source ranking -> evidence extraction
                                      -> evaluation/retry -> synthesis
```

Compatibility fields (`research_questions`, `search_queries`, and
`query_question_map`) remain in `ResearchState`. New typed plan and understanding
models are additive.

Local research retrieval creates a larger vector and lexical candidate pool for
each rewritten question. Lexical SQL applies `Document.space_id` before rows are
returned. Reciprocal-rank fusion merges the two channels by document/chunk identity,
then the provider-neutral reranker keeps the strongest evidence chunks. If lexical
retrieval or a future external reranker is unavailable, vector retrieval and the
deterministic local reranker remain valid fallbacks.

Web candidates are ranked before page fetch while preserving question diversity.
Fetched pages are ranked again and near-duplicate content is removed. Source scores
are explanatory retrieval metadata, never evidence themselves.
