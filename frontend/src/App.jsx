import { useEffect, useState } from 'react'
import ChatPage from './pages/ChatPage'
import LearnPage from './pages/LearnPage'
import { documentsApi, toFrontendFile } from './api/documents'
import { spacesApi } from './api/spaces'

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname === '/learn' ? '/learn' : '/chat')
  const [learningSpaces, setLearningSpaces] = useState([])
  const [documentsState, setDocumentsState] = useState({ loading: true, error: '' })

  useEffect(() => {
    if (window.location.pathname !== path) window.history.replaceState({}, '', path)
    const onPopState = () => setPath(window.location.pathname === '/learn' ? '/learn' : '/chat')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([spacesApi.list(), documentsApi.list()])
      .then(([spaces, { documents }]) => {
        if (cancelled) return
        setLearningSpaces(spaces.map((space) => ({
          ...space,
          files: documents.filter((document) => document.space_id === space.id).map(toFrontendFile),
        })))
        setDocumentsState({ loading: false, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setDocumentsState({ loading: false, error: error.message })
      })
    return () => { cancelled = true }
  }, [])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  return path === '/learn'
    ? <LearnPage learningSpaces={learningSpaces} setLearningSpaces={setLearningSpaces} documentsState={documentsState} onNavigate={navigate} />
    : <ChatPage onNavigate={navigate} />
}
