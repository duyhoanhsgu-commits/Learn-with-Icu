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

export const documentsApi = {
  list: () => request('/documents?limit=100'),
  get: (documentId) => request(`/documents/${documentId}`),
  upload: (file, spaceId) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('space_id', spaceId)
    return request('/documents/upload', { method: 'POST', body: formData })
  },
  remove: (documentId) => request(`/documents/${documentId}`, { method: 'DELETE' }),
}

export function toFrontendFile(document) {
  const statusMap = {
    completed: 'ready',
    ready: 'ready',
    failed: 'failed',
    pending: 'uploading',
    processing: 'uploading',
  }
  return {
    id: document.id,
    name: document.filename,
    type: document.file_type,
    size: formatBytes(document.file_size),
    status: statusMap[document.status] || 'uploading',
    backendStatus: document.status,
    chunkCount: document.chunk_count,
    persisted: true,
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
