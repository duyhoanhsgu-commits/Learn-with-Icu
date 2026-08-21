const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
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

export const spacesApi = {
  list: () => request('/spaces'),
  create: (name, color) => request('/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  }),
}
