import { BookOpen, BrainCircuit, Eraser, FileText, Lightbulb, LoaderCircle, Menu, PanelRightOpen, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import ContextWindowBar from '../components/chat/ContextWindowBar'
import ConversationSidebar from '../components/chat/ConversationSidebar'
import TutorOutputPanel from '../components/chat/TutorOutputPanel'
import BrandLogo from '../components/common/BrandLogo'
import { generalPrompts } from '../data/mockData'
import { askGeneralQuestion, conversationsApi, toFrontendSources } from '../api/chat'

const benefits = [
  { label: 'Explain concepts', icon: Lightbulb },
  { label: 'Practice with quizzes', icon: BrainCircuit },
  { label: 'Learn from your files', icon: FileText },
]

const conversationTitle = (question) => {
  const compact = question.replace(/\s+/g, ' ').trim()
  return compact.length <= 72 ? compact : `${compact.slice(0, 69).trim()}...`
}

const toFrontendMessage = (message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  sources: toFrontendSources(message.sources),
})

const storedPanelWidth = (key, fallback, min, max) => {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function ResizeDivider({ side, onPointerDown }) {
  return <div role="separator" aria-label={`Resize ${side} panel`} aria-orientation="vertical" onPointerDown={onPointerDown} className={`group relative hidden w-3 shrink-0 touch-none cursor-col-resize ${side === 'right' ? 'xl:block' : 'lg:block'}`}><span className="absolute inset-y-5 left-1/2 w-px -translate-x-1/2 bg-transparent transition group-hover:bg-brandblue/30" /><span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brandblue/40 opacity-0 transition group-hover:opacity-100" /></div>
}

export default function ChatPage({ onNavigate }) {
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [contextTokenCount, setContextTokenCount] = useState(0)
  const [contextTokenLimit, setContextTokenLimit] = useState(128000)
  const [contextCanCompact, setContextCanCompact] = useState(false)
  const [contextItems, setContextItems] = useState([])
  const [contextSummarizing, setContextSummarizing] = useState(false)
  const [contextDeletingId, setContextDeletingId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [leftWidth, setLeftWidth] = useState(() => storedPanelWidth('icu-tutor-left-width', 286, 240, 420))
  const [rightWidth, setRightWidth] = useState(() => storedPanelWidth('icu-tutor-output-width', 360, 300, 560))
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [outputMobileOpen, setOutputMobileOpen] = useState(false)
  const loadRequestRef = useRef(0)

  useEffect(() => { localStorage.setItem('icu-tutor-left-width', String(leftWidth)) }, [leftWidth])
  useEffect(() => { localStorage.setItem('icu-tutor-output-width', String(rightWidth)) }, [rightWidth])

  const startPanelResize = (side, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = side === 'left' ? leftWidth : rightWidth
    const update = side === 'left' ? setLeftWidth : setRightWidth
    const min = side === 'left' ? 240 : 300
    const hardMax = side === 'left' ? 420 : 560
    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      const proposed = side === 'left' ? startWidth + delta : startWidth - delta
      const otherWidth = side === 'left' && rightPanelOpen ? rightWidth : side === 'right' ? leftWidth : 0
      const viewportMax = window.innerWidth - otherWidth - 430
      update(Math.min(hardMax, Math.max(min, Math.min(proposed, viewportMax))))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const toggleOutputPanel = () => {
    if (window.innerWidth < 1280) {
      setRightPanelOpen(true)
      setOutputMobileOpen(true)
      return
    }
    setRightPanelOpen((open) => !open)
  }

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const items = await conversationsApi.list()
        if (cancelled) return
        setConversations(items)
      } catch (error) {
        if (!cancelled) setHistoryError(error.message)
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
          setConversationLoading(false)
        }
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [])

  const openConversation = async (conversationId) => {
    const requestId = ++loadRequestRef.current
    setActiveConversationId(conversationId)
    setConversationLoading(true)
    setHistoryError('')
    setDraft('')
    setSidebarOpen(false)
    try {
      const detail = await conversationsApi.get(conversationId)
      if (requestId === loadRequestRef.current) {
        setMessages(detail.messages.map(toFrontendMessage))
        setContextTokenCount(detail.context_token_count ?? 0)
        setContextTokenLimit(detail.context_token_limit ?? 128000)
        setContextCanCompact(detail.context_can_compact ?? false)
        setContextItems(detail.context_items ?? [])
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setMessages([])
        setContextTokenCount(0)
        setContextCanCompact(false)
        setContextItems([])
        setHistoryError(error.message)
      }
    } finally {
      if (requestId === loadRequestRef.current) setConversationLoading(false)
    }
  }

  const createNewConversation = async () => {
    if (isTyping || actionLoading) return null
    ++loadRequestRef.current
    setActionLoading(true)
    setHistoryError('')
    try {
      const created = await conversationsApi.create()
      setConversations((items) => [created, ...items])
      setActiveConversationId(created.id)
      setMessages([])
      setContextTokenCount(0)
      setContextCanCompact(false)
      setContextItems([])
      setDraft('')
      setConversationLoading(false)
      setSidebarOpen(false)
      return created
    } catch (error) {
      setHistoryError(error.message)
      return null
    } finally {
      setActionLoading(false)
    }
  }

  const deleteConversation = async (conversationId) => {
    if (isTyping || actionLoading) return
    const conversation = conversations.find((item) => item.id === conversationId)
    if (!window.confirm(`Delete “${conversation?.title || 'this conversation'}”?`)) return
    setActionLoading(true)
    setHistoryError('')
    try {
      await conversationsApi.remove(conversationId)
      const remaining = conversations.filter((item) => item.id !== conversationId)
      setConversations(remaining)
      if (activeConversationId === conversationId) {
        ++loadRequestRef.current
        setActiveConversationId(null)
        setMessages([])
        setContextTokenCount(0)
        setContextCanCompact(false)
        setContextItems([])
        setDraft('')
        if (remaining.length) await openConversation(remaining[0].id)
      }
    } catch (error) {
      setHistoryError(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const send = async (preparedPrompt = '') => {
    const content = (preparedPrompt || draft).trim()
    if (!content || isTyping || actionLoading || conversationLoading) return
    setDraft('')
    setIsTyping(true)
    setHistoryError('')
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'user', content }])

    try {
      let conversationId = activeConversationId
      if (!conversationId) {
        const created = await conversationsApi.create()
        conversationId = created.id
        setActiveConversationId(created.id)
        setConversations((items) => [created, ...items])
      }
      const response = await askGeneralQuestion({ question: content, sessionId: conversationId })
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: toFrontendSources(response.sources),
      }])
      try {
        const detail = await conversationsApi.get(conversationId)
        setContextTokenCount(detail.context_token_count ?? 0)
        setContextTokenLimit(detail.context_token_limit ?? 128000)
        setContextCanCompact(detail.context_can_compact ?? true)
        setContextItems(detail.context_items ?? [])
      } catch {
        // The answer is already saved; a failed meter refresh must not mark it as failed.
        setContextCanCompact(true)
      }
      const title = conversationTitle(content)
      const updatedAt = new Date().toISOString()
      setConversations((items) => {
        const current = items.find((item) => item.id === conversationId)
        const updated = { ...current, id: conversationId, title: current?.title === 'New conversation' || !current?.title ? title : current.title, updated_at: updatedAt }
        return [updated, ...items.filter((item) => item.id !== conversationId)]
      })
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: 'error', content: `Unable to reach ICU Tutor: ${error.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  const summarizeContext = async () => {
    if (!activeConversationId || !contextCanCompact || isTyping || actionLoading || conversationLoading) return
    setContextSummarizing(true)
    setActionLoading(true)
    setHistoryError('')
    try {
      const result = await conversationsApi.compact(activeConversationId)
      setContextTokenCount(result.context_token_count ?? 0)
      setContextTokenLimit(result.context_token_limit ?? 128000)
      setContextCanCompact(result.context_can_compact ?? false)
      setContextItems(result.context_items ?? [])
    } catch (error) {
      setHistoryError(error.message)
    } finally {
      setContextSummarizing(false)
      setActionLoading(false)
    }
  }

  const removeContextItem = async (itemId) => {
    if (!activeConversationId || !itemId || isTyping || actionLoading || conversationLoading) return
    setContextDeletingId(itemId)
    setActionLoading(true)
    setHistoryError('')
    try {
      await conversationsApi.removeContextItem(activeConversationId, itemId)
      const detail = await conversationsApi.get(activeConversationId)
      setContextTokenCount(detail.context_token_count ?? 0)
      setContextTokenLimit(detail.context_token_limit ?? 128000)
      setContextCanCompact(detail.context_can_compact ?? false)
      setContextItems(detail.context_items ?? [])
    } catch (error) {
      setHistoryError(error.message)
    } finally {
      setContextDeletingId('')
      setActionLoading(false)
    }
  }

  const clearChat = async () => {
    if (!activeConversationId || !messages.length || isTyping || actionLoading || conversationLoading) return
    if (!window.confirm('Clear the visible chat? Your current context window will be kept.')) return
    setActionLoading(true)
    setHistoryError('')
    try {
      await conversationsApi.clear(activeConversationId)
      setMessages([])
      setDraft('')
    } catch (error) {
      setHistoryError(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const sidebarDisabled = historyLoading || isTyping || actionLoading || conversationLoading

  return <main className="flex h-[100dvh] overflow-hidden bg-canvas p-3 sm:p-4">
    <ConversationSidebar desktopWidth={leftWidth} conversations={conversations} activeId={activeConversationId} loading={historyLoading} error={historyError} open={sidebarOpen} disabled={sidebarDisabled} onClose={() => setSidebarOpen(false)} onNew={createNewConversation} onSelect={openConversation} onDelete={deleteConversation} onPersonalize={() => onNavigate('/personalization')} />
    <ResizeDivider side="left" onPointerDown={(event) => startPanelResize('left', event)} />

    <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <header className="flex min-h-[72px] shrink-0 items-center justify-between rounded-[20px] border border-line bg-white px-3 shadow-[0_4px_20px_rgba(15,23,42,.04)] sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open conversation history" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-slate-50 hover:text-ink lg:hidden"><Menu size={18} /></button><BrandLogo className="h-10 w-10 rounded-xl border border-line bg-white p-0.5 shadow-sm" /><div className="min-w-0"><h1 className="truncate font-['Manrope'] text-sm font-bold text-ink">{conversations.find((item) => item.id === activeConversationId)?.title || 'ICU Tutor'}</h1><p className="mt-0.5 truncate text-[10px] text-muted">Your AI learning companion</p></div></div>
        <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={toggleOutputPanel} aria-label="Toggle output workspace" title="Text and code workspace" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${rightPanelOpen ? 'border-brandblue/20 bg-brandblue/[.07] text-brandblue' : 'border-line bg-white text-muted hover:bg-slate-50 hover:text-ink'}`}><PanelRightOpen size={16} /></button><button type="button" onClick={clearChat} disabled={!messages.length || isTyping || actionLoading || conversationLoading} aria-label="Clear visible chat" title="Clear chat without removing context" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"><Eraser size={15} /><span className="hidden md:inline">Clear chat</span></button><button onClick={() => onNavigate('/learn')} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brandblue px-3.5 text-xs font-semibold text-white transition hover:bg-[#426de8] sm:px-4"><BookOpen size={15} /><span className="hidden sm:inline">Learn with your files</span><span className="sm:hidden">Your files</span></button></div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_4px_20px_rgba(15,23,42,.04)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {conversationLoading ? <div className="grid h-full place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-brandblue" /><p className="mt-3 text-xs text-muted">Loading conversation…</p></div></div> : messages.length ? <MessageList messages={messages} isTyping={isTyping} variant="general" /> : <section className="relative flex h-full min-h-[390px] flex-col items-center justify-center overflow-hidden px-5 pb-4 pt-6 text-center sm:px-8">
          <div className="general-hero-content relative z-10 flex flex-col items-center">
            <BrandLogo className="h-14 w-14 rounded-[18px] border border-line bg-white p-1.5 shadow-[0_4px_16px_rgba(15,23,42,.06)]" />
            <p className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-brandblue"><Sparkles size={13} />ICU Tutor</p>
            <h2 className="mt-3 max-w-[700px] font-['Manrope'] text-[28px] font-bold leading-[1.15] tracking-[-.03em] text-ink sm:text-[32px]">What would you like to learn today?</h2>
            <p className="mt-4 max-w-xl text-[14px] leading-7 text-muted">Ask a question, explore a new topic, or test what you already know.</p>
            <div className="mt-7 hidden items-center justify-center gap-7 sm:flex">{benefits.map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 text-xs font-medium text-muted"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brandblue/[.08] text-brandblue"><Icon size={14} /></span>{label}</div>)}</div>
          </div>
        </section>}
        </div>

      <div className="general-chat-bottom shrink-0 bg-white px-0 pb-1 pt-3 sm:px-4">
        {!messages.length && !conversationLoading ? <SuggestedPrompts prompts={generalPrompts} onSelect={setDraft} variant="landing" /> : null}
        <ContextWindowBar tokenCount={contextTokenCount} tokenLimit={contextTokenLimit} contextItems={contextItems} canSummarize={contextCanCompact} disabled={isTyping || actionLoading || conversationLoading} summarizing={contextSummarizing} deletingId={contextDeletingId} onSummary={summarizeContext} onDeleteItem={removeContextItem} />
        <ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={isTyping || actionLoading || conversationLoading} placeholder="Ask ICU anything…" variant="general" />
      </div>
      </div>
    </section>
    {rightPanelOpen ? <><ResizeDivider side="right" onPointerDown={(event) => startPanelResize('right', event)} /><TutorOutputPanel messages={messages} width={rightWidth} mobileOpen={outputMobileOpen} onCloseMobile={() => setOutputMobileOpen(false)} onCollapse={() => setRightPanelOpen(false)} /></> : null}
  </main>
}
