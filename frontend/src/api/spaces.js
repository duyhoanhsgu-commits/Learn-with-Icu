const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

async function request(path, options = {}) {
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

export const spacesApi = {
  list: () => request('/spaces'),
  create: (name, color) => request('/spaces', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  }),
  getContext: (spaceId) => request(`/spaces/${encodeURIComponent(spaceId)}/context`),
  updateContext: (spaceId, fixedContext) => request(`/spaces/${encodeURIComponent(spaceId)}/context`, {
    method: 'PUT',
    body: JSON.stringify({ fixed_context: fixedContext }),
  }),
  listMemories: (spaceId) => request(`/spaces/${encodeURIComponent(spaceId)}/memories`),
  createMemory: (spaceId, memory) => request(`/spaces/${encodeURIComponent(spaceId)}/memories`, {
    method: 'POST',
    body: JSON.stringify(memory),
  }),
  updateMemory: (spaceId, memoryId, memory) => request(`/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}`, {
    method: 'PUT',
    body: JSON.stringify(memory),
  }),
  deleteMemory: (spaceId, memoryId) => request(`/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE',
  }),
}
