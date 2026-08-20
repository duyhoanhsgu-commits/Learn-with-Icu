import { BookOpen, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import { assistantReply, generalPrompts } from '../data/mockData'

export default function ChatPage({ onNavigate }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const timerRef = useRef(null)
  const send = () => {
    const content = draft.trim()
    if (!content || isTyping) return
    setDraft(''); setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', content }]); setIsTyping(true)
    timerRef.current = setTimeout(() => { setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'assistant', content: assistantReply }]); setIsTyping(false) }, 500)
  }
  const restart = () => { clearTimeout(timerRef.current); setMessages([]); setIsTyping(false) }
  return <main className="flex h-screen flex-col overflow-hidden bg-canvas"><header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/70 px-5 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-[10px] font-bold text-white">IC</div><div><h1 className="font-['Manrope'] text-sm font-bold">ICU Tutor</h1><p className="mt-0.5 text-[10px] text-slate-500">Your AI learning companion</p></div></div><button onClick={() => onNavigate('/learn')} className="flex items-center gap-2 rounded-xl bg-navy px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-teal sm:px-4"><BookOpen size={15} /><span className="hidden sm:inline">Learn with your files</span><span className="sm:hidden">Your files</span></button></header><div className="min-h-0 flex-1 overflow-y-auto">{messages.length ? <MessageList messages={messages} isTyping={isTyping} /> : <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-navy text-sm font-bold text-white shadow-lg shadow-slate-300">IC</div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal"><Sparkles size={14} /> ICU Tutor</p><h2 className="font-['Manrope'] text-2xl font-bold tracking-tight text-ink sm:text-3xl">What would you like to learn today?</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-500">Ask a question, explore a new topic, or test what you already know.</p></div>}</div><div className="shrink-0 border-t border-slate-200/70 bg-canvas px-0 pb-4 pt-3 sm:px-6 sm:pb-5"><SuggestedPrompts prompts={generalPrompts} onSelect={setDraft} /><ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={isTyping} placeholder="Ask ICU anything..." />{messages.length > 0 && <button onClick={restart} className="mx-auto mt-1 block text-[10px] text-slate-400 hover:text-teal">Start over</button>}</div></main>
}
