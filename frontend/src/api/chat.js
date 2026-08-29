const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export async function askQuestion({ question, sessionId, spaceId, imageDataUrl, mode = 'auto', topK = 5, scoreThreshold = 0 }) {
  const response = await fetch(`${API_BASE_URL}/chat/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      session_id: sessionId,
      space_id: spaceId,
      image_data_url: imageDataUrl,
      mode,
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

export async function askGeneralQuestion({ question, sessionId, mode = 'auto' }) {
  const response = await fetch(`${API_BASE_URL}/chat/general`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId, mode }),
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

async function streamChat(path, payload, onToken, onProgress) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
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
  if (!response.body) throw new Error('Streaming is not supported by this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = null

  const consumeEvent = (block) => {
    const data = block.split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data) return
    const event = JSON.parse(data)
    if (event.type === 'token') onToken?.(event.token || '')
    if (event.type === 'progress') onProgress?.(event)
    if (event.type === 'done') completed = event
    if (event.type === 'error') throw new Error(event.message || 'Streaming response failed.')
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      consumeEvent(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
    if (done) break
  }
  if (buffer.trim()) consumeEvent(buffer)
  if (!completed) throw new Error('The response stream ended before completion.')
  return completed
}

export function streamGeneralQuestion({ question, sessionId, mode = 'auto' }, onToken, onProgress) {
  return streamChat('/chat/general/stream', { question, session_id: sessionId, mode }, onToken, onProgress)
}

export function streamQuestion({ question, sessionId, spaceId, imageDataUrl, mode = 'auto', topK = 5, scoreThreshold = 0 }, onToken, onProgress) {
  return streamChat('/chat/stream', {
    question,
    session_id: sessionId,
    space_id: spaceId,
    image_data_url: imageDataUrl,
    mode,
    top_k: topK,
    score_threshold: scoreThreshold,
    stream: true,
  }, onToken, onProgress)
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
  removeContextItem: (conversationId, itemId) => conversationRequest(`/chat/conversations/${conversationId}/context/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  clear: (conversationId) => conversationRequest(`/chat/conversations/${conversationId}/clear`, { method: 'POST' }),
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
