import { BrainCircuit, ChevronRight, LibraryBig, LoaderCircle, Network, PanelRightClose, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toolsApi } from '../../api/tools'
import FlashcardPlayer from './FlashcardPlayer'
import MindMapViewer from './MindMapViewer'
import QuizPlayer from './QuizPlayer'

const tools = [
  { id: 'quiz', name: 'Quiz', savedLabel: 'quizzes', actionLabel: 'Generate Quiz', description: 'Test your understanding with focused questions.', icon: BrainCircuit, prompt: 'Create a 10-question multiple-choice quiz from these documents. Give four options per question, wait for my answers, then grade and explain each answer.' },
  { id: 'mindmap', name: 'Mind map', savedLabel: 'mind maps', actionLabel: 'Generate Mind Map', description: 'Connect key concepts in a clear visual hierarchy.', icon: Network, prompt: 'Create a structured mind map from these documents. Start with one central topic, then organize major branches, subtopics, and their relationships.' },
  { id: 'flashcards', name: 'Flashcards', savedLabel: 'flashcards', actionLabel: 'Generate Flashcards', description: 'Turn important ideas into quick study cards.', icon: LibraryBig, prompt: 'Create 15 concise flashcards from the most important ideas in these documents. Format each card with a clear front and back.' },
]
const storageKey = 'icu-learning-tool-prompts'
const defaultPrompts = Object.fromEntries(tools.map((tool) => [tool.id, tool.prompt]))

function loadPrompts() {
  try {
    return { ...defaultPrompts, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }
  } catch {
    return defaultPrompts
  }
}

function itemMetadata(type, item) {
  if (type === 'quiz') return `${item.question_count} questions`
  if (type === 'mindmap') return `${item.root?.children?.length || 0} main branches`
  return `${item.card_count} cards`
}

export default function ToolsPanel({ disabled, spaceId, onCollapse }) {
  const [active, setActive] = useState('quiz')
  const [prompts, setPrompts] = useState(loadPrompts)
  const [savedTools, setSavedTools] = useState({ quiz: [], mindmap: [], flashcards: [] })
  const [openTool, setOpenTool] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const selected = tools.find((tool) => tool.id === active)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(prompts))
  }, [prompts])

  useEffect(() => {
    if (!spaceId) {
      setSavedTools({ quiz: [], mindmap: [], flashcards: [] })
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      toolsApi.list(spaceId, 'quiz'),
      toolsApi.list(spaceId, 'mindmap'),
      toolsApi.list(spaceId, 'flashcards'),
    ]).then(([quiz, mindmap, flashcards]) => {
      if (!cancelled) setSavedTools({ quiz, mindmap, flashcards })
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [spaceId])

  const currentPrompt = prompts[active] || ''
  const activeItems = savedTools[active] || []
  const SelectedIcon = selected.icon

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const generators = {
        quiz: toolsApi.createQuiz,
        mindmap: toolsApi.createMindMap,
        flashcards: toolsApi.createFlashcards,
      }
      const item = await generators[active](spaceId, currentPrompt.trim())
      setSavedTools((items) => ({ ...items, [active]: [item, ...items[active]] }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteSavedTool = async (type, toolId) => {
    setError('')
    try {
      await toolsApi.delete(toolId)
      setSavedTools((items) => ({ ...items, [type]: items[type].filter((tool) => tool.id !== toolId) }))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (openTool?.type === 'quiz') return <div className="relative h-full"><PanelCollapseButton onCollapse={onCollapse} /><QuizPlayer quiz={openTool.item} onExit={() => setOpenTool(null)} /></div>
  if (openTool?.type === 'mindmap') return <div className="relative h-full"><PanelCollapseButton onCollapse={onCollapse} /><MindMapViewer mindmap={openTool.item} onExit={() => setOpenTool(null)} /></div>
  if (openTool?.type === 'flashcards') return <div className="relative h-full"><PanelCollapseButton onCollapse={onCollapse} /><FlashcardPlayer flashcards={openTool.item} onExit={() => setOpenTool(null)} /></div>

  return <aside className="flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_4px_20px_rgba(15,23,42,.04)]">
    <header className="shrink-0 px-5 pb-4 pt-5">
      <p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Study tools</p>
      <div className="mt-1 flex items-center justify-between"><h2 className="font-['Manrope'] text-base font-bold text-ink">Learn your way</h2><div className="flex items-center gap-2"><Sparkles size={16} className="text-violet" />{onCollapse && <button onClick={onCollapse} title="Collapse study tools" aria-label="Collapse study tools panel" className="hidden h-9 w-9 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brandblue/30 hover:bg-brandblue/[.05] hover:text-brandblue lg:grid"><PanelRightClose size={17} /></button>}</div></div>
    </header>

    <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:px-5">
      {tools.map((tool) => {
        const Icon = tool.icon
        const selectedTool = active === tool.id
        return <button key={tool.id} onClick={() => setActive(tool.id)} className={`flex min-w-0 flex-col items-center rounded-[14px] border px-2 py-3 text-center transition ${selectedTool ? 'border-brandblue/40 bg-brandblue/[.06] shadow-[0_5px_16px_rgba(52,133,245,.08)]' : 'border-line bg-white hover:border-slate-300 hover:bg-slate-50'}`}><span className={`grid h-8 w-8 place-items-center rounded-[10px] ${selectedTool ? 'bg-brandblue/10 text-brandblue' : 'bg-slate-100 text-muted'}`}><Icon size={16} /></span><span className={`mt-2 truncate text-[10px] font-bold ${selectedTool ? 'text-ink' : 'text-muted'}`}>{tool.name}</span></button>
      })}
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-canvas/70 p-4 sm:p-5">
      <section className="rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_25px_rgba(18,33,59,.05)] sm:p-5">
        <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-teal/10 text-teal"><SelectedIcon size={20} /></div><div className="min-w-0"><h3 className="font-['Manrope'] text-sm font-bold text-ink">{selected.name}</h3><p className="mt-1 text-[10px] leading-4 text-muted">{selected.description}</p></div></div>

        <div className="mt-5"><div className="mb-2 flex items-center justify-between"><label htmlFor={`prompt-${active}`} className="text-[9px] font-bold uppercase tracking-[.14em] text-muted">Customize your {selected.name.toLowerCase()}</label><button onClick={() => setPrompts((items) => ({ ...items, [active]: defaultPrompts[active] }))} title="Reset prompt" className="flex items-center gap-1 text-[9px] font-semibold text-muted transition hover:text-teal"><RotateCcw size={11} />Reset</button></div><textarea id={`prompt-${active}`} value={currentPrompt} onChange={(event) => setPrompts((items) => ({ ...items, [active]: event.target.value }))} rows={6} maxLength={2000} placeholder={`Describe your ${selected.name.toLowerCase()}...`} className="w-full resize-y rounded-xl border border-line bg-canvas px-3 py-3 text-[11px] leading-5 text-ink outline-none transition placeholder:text-muted/70 focus:border-brandblue/50 focus:bg-white focus:ring-4 focus:ring-brandblue/10" /><p className="mt-1 text-right text-[9px] text-muted">{currentPrompt.length}/2000</p></div>

        {error && <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-600">{error}</p>}
        <button disabled={disabled || loading || !currentPrompt.trim()} onClick={generate} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brandblue px-4 py-3 text-[11px] font-bold text-white transition hover:bg-[#426de8] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{loading && <LoaderCircle size={14} className="animate-spin" />}{loading ? 'Working…' : selected.actionLabel}</button>
      </section>

      {activeItems.length > 0 && <section className="mt-5"><div className="mb-2.5 flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-muted">Saved {selected.savedLabel}</p><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-muted shadow-sm">{activeItems.length}</span></div><div className="space-y-2">{activeItems.map((item) => <div key={item.id} className="group flex items-center gap-2 rounded-[14px] border border-line bg-white p-2.5 shadow-sm transition hover:border-brandblue/25"><button onClick={() => setOpenTool({ type: active, item })} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-teal/10 text-teal"><SelectedIcon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-ink">{item.title}</span><span className="mt-0.5 block text-[9px] text-muted">{itemMetadata(active, item)}</span></span><ChevronRight size={14} className="shrink-0 text-slate-300" /></button><button onClick={() => deleteSavedTool(active, item.id)} title={`Delete ${selected.name.toLowerCase()}`} aria-label={`Delete ${item.title}`} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button></div>)}</div></section>}
    </div>
  </aside>
}

function PanelCollapseButton({ onCollapse }) {
  if (!onCollapse) return null
  return <button onClick={onCollapse} title="Collapse study tools" aria-label="Collapse study tools panel" className="absolute right-3 top-3 z-30 hidden h-9 w-9 place-items-center rounded-xl border border-line bg-white/95 text-muted shadow-sm backdrop-blur transition hover:border-brandblue/30 hover:bg-brandblue/[.05] hover:text-brandblue lg:grid"><PanelRightClose size={17} /></button>
}
