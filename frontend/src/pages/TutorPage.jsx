import { useRef, useState } from 'react'
import Sidebar from '../components/layout/Sidebar'
import ChatHeader from '../components/layout/ChatHeader'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import { assistantReply, modules, sessions, suggestedPrompts } from '../data/mockData'

export default function TutorPage() {
  const [activeId, setActiveId] = useState(sessions[0].id)
  const [sessionMessages, setSessionMessages] = useState(() => Object.fromEntries(sessions.map((s) => [s.id, s.messages])))
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const timerRef = useRef(null)
  const active = sessions.find((session) => session.id === activeId) || sessions[0]
  const messages = sessionMessages[activeId] || []

  const selectSession = (id) => { clearTimeout(timerRef.current); setIsTyping(false); setActiveId(id); setSidebarOpen(false) }
  const restart = () => { clearTimeout(timerRef.current); setIsTyping(false); setSessionMessages((all) => ({ ...all, [activeId]: [{ id: Date.now(), role: 'assistant', content: 'What would you like to learn today?' }] })) }
  const newSession = () => { setActiveId('new'); setSessionMessages((all) => ({ ...all, new: [{ id: Date.now(), role: 'assistant', content: 'What would you like to learn today?' }] })); setSidebarOpen(false) }
  const sendMessage = (text = draft) => {
    const content = text.trim()
    if (!content || isTyping) return
    const targetId = activeId
    setDraft('')
    setSessionMessages((all) => ({ ...all, [targetId]: [...(all[targetId] || []), { id: Date.now(), role: 'user', content }] }))
    setIsTyping(true)
    timerRef.current = setTimeout(() => {
      setSessionMessages((all) => ({ ...all, [targetId]: [...(all[targetId] || []), { id: Date.now() + 1, role: 'assistant', content: assistantReply }] }))
      setIsTyping(false)
    }, 500)
  }

  const title = activeId === 'new' ? 'New learning session' : active.title
  const subject = activeId === 'new' ? 'Open study' : active.subject
  return <main className="flex h-screen overflow-hidden bg-canvas"><Sidebar sessions={sessions} modules={modules} activeId={activeId} onSelect={selectSession} onNew={newSession} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><section className="flex min-w-0 flex-1 flex-col"><ChatHeader title={title} subject={subject} onMenu={() => setSidebarOpen(true)} onRestart={restart} /><div className="min-h-0 flex-1 overflow-y-auto"><MessageList messages={messages} isTyping={isTyping} /></div><div className="shrink-0 border-t border-slate-200/70 bg-canvas px-0 pb-4 pt-3 sm:px-6 sm:pb-5"><SuggestedPrompts prompts={suggestedPrompts} onSelect={setDraft} /><ChatInput value={draft} onChange={setDraft} onSubmit={() => sendMessage()} disabled={isTyping} /></div></section></main>
}
