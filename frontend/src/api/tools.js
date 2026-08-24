const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const toolsApi = {
  list: async (spaceId, toolType = 'quiz') => {
    const query = new URLSearchParams({ space_id: spaceId, tool_type: toolType })
    const response = await fetch(`${API_BASE_URL}/tools?${query}`)
    if (!response.ok) throw new Error(`Could not load learning tools (${response.status})`)
    return response.json()
  },
  createQuiz: async (spaceId, prompt) => {
    const response = await fetch(`${API_BASE_URL}/tools/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ space_id: spaceId, prompt }),
    })
    if (!response.ok) {
      let message = `Quiz generation failed (${response.status})`
      try {
        const body = await response.json()
        message = body.detail || message
      } catch {
        // Keep the status fallback for non-JSON errors.
      }
      throw new Error(message)
    }
    return response.json()
  },
  delete: async (toolId) => {
    const response = await fetch(`${API_BASE_URL}/tools/${toolId}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(`Could not delete learning tool (${response.status})`)
  },
}
