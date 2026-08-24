import { BookOpen, BrainCircuit, FileText, Lightbulb, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import BrandLogo from '../components/common/BrandLogo'
import { generalPrompts } from '../data/mockData'
import { askGeneralQuestion, toFrontendSources } from '../api/chat'

const benefits = [
  { label: 'Explain concepts', icon: Lightbulb },
  { label: 'Practice with quizzes', icon: BrainCircuit },
  { label: 'Learn from your files', icon: FileText },
]

export default function ChatPage({ onNavigate }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const sessionIdRef = useRef(crypto.randomUUID())

  const send = async () => {
    const content = draft.trim()
    if (!content || isTyping) return
    setDraft('')
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', content }])
    setIsTyping(true)
    try {
      const response = await askGeneralQuestion({ question: content, sessionId: sessionIdRef.current })
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: toFrontendSources(response.sources),
      }])
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'error', content: `Unable to reach ICU Tutor: ${error.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  const restart = () => {
    sessionIdRef.current = crypto.randomUUID()
    setMessages([])
    setIsTyping(false)
  }

  return <main className="flex h-[100dvh] flex-col overflow-hidden bg-canvas">
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-white px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-3"><BrandLogo className="h-10 w-10 rounded-xl bg-white p-0.5 shadow-[0_7px_18px_rgba(11,25,48,.14)] ring-1 ring-line" /><div className="min-w-0"><h1 className="truncate font-['Manrope'] text-sm font-bold text-ink">ICU Tutor</h1><p className="mt-0.5 truncate text-[10px] text-muted">Your AI learning companion</p></div></div>
      <button onClick={() => onNavigate('/learn')} className="flex shrink-0 items-center gap-2 rounded-xl bg-navy px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(11,25,48,.13)] transition hover:-translate-y-0.5 hover:bg-teal hover:shadow-[0_8px_20px_rgba(18,184,170,.2)] sm:px-4"><BookOpen size={15} /><span className="hidden sm:inline">Learn with your files</span><span className="sm:hidden">Your files</span></button>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {messages.length ? <MessageList messages={messages} isTyping={isTyping} /> : <section className="relative flex h-full min-h-[390px] flex-col items-center justify-center overflow-hidden px-5 pb-4 pt-6 text-center sm:px-8">
        <div aria-hidden="true" className="general-hero-glow absolute left-1/2 top-[46%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="general-hero-content relative z-10 flex flex-col items-center">
          <BrandLogo className="h-20 w-20 rounded-[20px] border border-line bg-white p-2 shadow-[0_18px_42px_rgba(11,25,48,.16)]" />
          <p className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-teal"><Sparkles size={13} />ICU Tutor</p>
          <h2 className="mt-3 max-w-[700px] font-['Manrope'] text-[32px] font-bold leading-[1.12] tracking-[-.035em] text-navy sm:text-[42px] lg:text-[48px]">What would you like to learn today?</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted sm:text-[17px]">Ask a question, explore a new topic, or test what you already know.</p>
          <div className="mt-7 hidden items-center justify-center gap-7 sm:flex">{benefits.map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 text-xs font-medium text-muted"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal/[.08] text-teal"><Icon size={14} /></span>{label}</div>)}</div>
        </div>
      </section>}
    </div>

    <div className={`general-chat-bottom shrink-0 bg-canvas px-0 pt-3 sm:px-4 ${messages.length ? 'border-t border-line' : ''}`}>
      <SuggestedPrompts prompts={generalPrompts} onSelect={setDraft} variant="landing" />
      <ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={isTyping} placeholder="Ask ICU anything…" variant="general" />
      {messages.length > 0 && <button onClick={restart} className="mx-auto mt-1 block rounded-md px-2 py-1 text-[10px] text-muted transition hover:text-teal">Start over</button>}
    </div>
  </main>
}
