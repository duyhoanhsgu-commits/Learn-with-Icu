import { useEffect, useState } from 'react'
import ChatPage from './pages/ChatPage'
import LearnPage from './pages/LearnPage'
import { initialLearningSpaces } from './data/mockData'

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname === '/learn' ? '/learn' : '/chat')
  const [learningSpaces, setLearningSpaces] = useState(initialLearningSpaces)

  useEffect(() => {
    if (window.location.pathname !== path) window.history.replaceState({}, '', path)
    const onPopState = () => setPath(window.location.pathname === '/learn' ? '/learn' : '/chat')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  return path === '/learn'
    ? <LearnPage learningSpaces={learningSpaces} setLearningSpaces={setLearningSpaces} onNavigate={navigate} />
    : <ChatPage onNavigate={navigate} />
}
