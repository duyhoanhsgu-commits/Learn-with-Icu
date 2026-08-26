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

async function conversationRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  return response.status === 204 ? null : response.json()
}

export const conversationsApi = {
  list: () => conversationRequest('/chat/conversations?chat_type=general'),
  create: () => conversationRequest('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: 'New conversation' }),
  }),
  get: (conversationId) => conversationRequest(`/chat/conversations/${conversationId}`),
  compact: (conversationId) => conversationRequest(`/chat/conversations/${conversationId}/compact`, { method: 'POST' }),
  remove: (conversationId) => conversationRequest(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),
}

export function toFrontendSources(sources = []) {
  return sources.map((source) => ({
    fileId: source.document_id || null,
    chunkId: source.chunk_id || null,
    chunkIndex: source.chunk_index ?? null,
    text: source.text || '',
    fileName: source.source || 'Document',
    page: source.page ?? source.metadata?.page ?? null,
    score: source.score,
    url: source.url,
  }))
}
