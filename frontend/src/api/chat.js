const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export async function askQuestion({ question, sessionId, spaceId, imageDataUrl, topK = 5, scoreThreshold = 0 }) {
  const response = await fetch(`${API_BASE_URL}/chat/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      session_id: sessionId,
      space_id: spaceId,
      image_data_url: imageDataUrl,
      top_k: topK,
      score_threshold: scoreThreshold,
    }),
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.detail || body.message || message
    } catch {
      // Keep the HTTP status fallback when the response is not JSON.
    }
    throw new Error(message)
  }

  return response.json()
}

export async function askGeneralQuestion({ question, sessionId }) {
  const response = await fetch(`${API_BASE_URL}/chat/general`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.detail || body.message || message
    } catch {
      // Keep the HTTP status fallback when the response is not JSON.
    }
    throw new Error(message)
  }
  return response.json()
}

export function toFrontendSources(sources = []) {
  return sources.map((source) => ({
    fileId: source.document_id || source.chunk_id || source.source,
    fileName: source.source || 'Document',
    page: source.page ?? source.metadata?.page ?? null,
    score: source.score,
    url: source.url,
  }))
}
