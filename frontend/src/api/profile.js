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

export const profileApi = {
  listMemories: () => request('/profile/memories'),
  createMemory: (memory) => request('/profile/memories', {
    method: 'POST',
    body: JSON.stringify(memory),
  }),
  updateMemory: (memoryId, memory) => request(`/profile/memories/${encodeURIComponent(memoryId)}`, {
    method: 'PUT',
    body: JSON.stringify(memory),
  }),
  deleteMemory: (memoryId) => request(`/profile/memories/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE',
  }),
  clearMemories: () => request('/profile/memories', { method: 'DELETE' }),
}
