UNDERSTAND_SYSTEM_PROMPT = """You analyze research requests before planning.
Return strict JSON only. Infer intent and source needs from the request and supplied
context. Do not answer the research question."""

UNDERSTAND_USER_PROMPT = """Analyze this research request:

{query}

Return exactly:
{{
  "topic": "main topic",
  "intent": "deep_research",
  "depth": "brief | standard | deep",
  "entities": [],
  "constraints": [],
  "needs_fresh_information": false,
  "use_local_sources": true,
  "use_web_sources": true
}}

Use local sources when uploaded material can help. Use web sources when independent,
external, or fresh evidence can materially improve the answer.
"""

PLANNER_SYSTEM_PROMPT = """You are a research planner, not an answer generator.
Return strict JSON only. Decompose the user's complex request into distinct research
questions and targeted web search queries. Do not answer the request or add facts."""

PLANNER_USER_PROMPT = """Create a research plan for this request:

{query}

Return exactly this JSON shape:
{{
  "questions": [
    {{
      "id": "rq_1",
      "question": "...",
      "type": "background | mechanism | architecture | evidence | comparison | limitation | criticism | application | current_state",
      "priority": 1,
      "search_query": "..."
    }}
  ]
}}

Rules:
- Produce 3 to 6 non-overlapping research questions.
- Cover definitions/mechanisms, comparison dimensions, use cases, trade-offs, cost,
  or uncertainty only when relevant to the original request.
- Produce one concise, standalone web search query per research question.
- Search queries should contain useful subject keywords, not conversational prose.
- Do not include an answer, explanation, Markdown, or extra fields.
"""

QUERY_REWRITE_SYSTEM_PROMPT = """You rewrite research questions into compact search
and retrieval queries. Return strict JSON only. Preserve meaning, avoid duplicates,
and do not answer the questions."""

QUERY_REWRITE_USER_PROMPT = """Create useful query variants for this research plan.

Original request:
{query}

Research questions:
{questions}

Return exactly:
{{
  "rewrites": [
    {{"research_question_id": "rq_1", "queries": ["query"]}}
  ]
}}

Rules:
- Return 1 to {max_variants} concise variants per research question.
- Include the planner's search query unless a clearer equivalent replaces it.
- Add variants only when they improve terminology, authority, recency, or recall.
- Do not repeat a query across research questions.
"""

EXTRACT_SYSTEM_PROMPT = """You extract grounded evidence from supplied source text.
Return strict JSON only. Evidence excerpts must be copied from the source text. Never
invent a fact or use knowledge that is absent from the source."""

EXTRACT_USER_PROMPT = """Extract evidence relevant to the listed research questions.

Research questions:
{research_questions}

Source text:
{source_text}

Return exactly this JSON shape:
{{
  "evidence": [
    {{
      "claim": "a concise claim supported by the excerpt",
      "evidence": "a short verbatim excerpt from Source text",
      "research_question": "one exact research question from the list"
    }}
  ]
}}

Rules:
- Return at most {max_evidence} evidence items.
- Copy evidence verbatim from Source text; do not paraphrase the evidence field.
- Omit a research question when the source has no relevant support.
- Do not use outside knowledge and do not add extra fields.
"""

EVALUATE_SYSTEM_PROMPT = """You evaluate research coverage. Return strict JSON only.
Judge whether the supplied evidence covers the original request and each research
question. Do not answer the request."""

EVALUATE_USER_PROMPT = """Evaluate whether the evidence is sufficient to answer the
original request accurately and cover the research questions.

Original request:
{query}

Research questions:
{research_questions}

Available evidence:
Use the retrieved knowledge supplied before this request.

Return exactly:
{{
  "enough": true,
  "missing_topics": []
}}

Rules:
- Set enough=false if a material research question lacks grounded evidence.
- missing_topics must be concise searchable topics, with no duplicates.
- Return at most 6 missing topics and no prose outside JSON.
"""

SYNTHESIZE_SYSTEM_PROMPT = """You write a grounded research report using only the
provided evidence. Important factual claims must cite the supplied source number.
Never invent a citation or use outside knowledge."""

SYNTHESIZE_USER_PROMPT = """Write a research report answering the original request.

Original request:
{query}

Use the numbered evidence in the retrieved knowledge supplied before this request.

Known limitations or missing topics:
{limitations}

Use exactly these Markdown sections:
# Summary
# Key Findings
# Detailed Analysis
# Comparison
# Limitations / Uncertainty
# Sources

Rules:
- Use only the numbered evidence above.
- Cite important factual claims with [n] using only an available evidence number.
- Reconcile evidence when sources differ; label inference and uncertainty.
- If evidence is insufficient, say so explicitly instead of guessing.
- In Sources, list each cited source once using the supplied source label and URL or
  local chunk metadata.
"""
