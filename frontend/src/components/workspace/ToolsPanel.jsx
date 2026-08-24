import { BrainCircuit, ChevronRight, LibraryBig, LoaderCircle, Network, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toolsApi } from '../../api/tools'
import QuizPlayer from './QuizPlayer'

const tools = [
  { id: 'quiz', name: 'Quiz', description: 'Test your understanding', icon: BrainCircuit, prompt: 'Create a 10-question multiple-choice quiz from these documents. Give four options per question, wait for my answers, then grade and explain each answer.' },
  { id: 'mindmap', name: 'Mind map', description: 'Connect the key concepts', icon: Network, prompt: 'Create a structured mind map from these documents. Start with one central topic, then organize major branches, subtopics, and their relationships.' },
  { id: 'flashcards', name: 'Flashcards', description: 'Review important facts', icon: LibraryBig, prompt: 'Create 15 concise flashcards from the most important ideas in these documents. Format each card with a clear front and back.' },
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

export default function ToolsPanel({ disabled, onUseTool, spaceId }) {
  const [active, setActive] = useState('quiz')
  const [prompts, setPrompts] = useState(loadPrompts)
  const [quizzes, setQuizzes] = useState([])
  const [openQuiz, setOpenQuiz] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')
  const selected = tools.find((tool) => tool.id === active)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(prompts))
  }, [prompts])

  useEffect(() => {
    if (!spaceId) {
      setQuizzes([])
      return undefined
    }
    let cancelled = false
    setQuizLoading(true)
    setQuizError('')
    toolsApi.list(spaceId)
      .then((items) => { if (!cancelled) setQuizzes(items) })
      .catch((error) => { if (!cancelled) setQuizError(error.message) })
      .finally(() => { if (!cancelled) setQuizLoading(false) })
    return () => { cancelled = true }
  }, [spaceId])

  const currentPrompt = prompts[active] || ''
  const updatePrompt = (value) => setPrompts((items) => ({ ...items, [active]: value }))
  const resetPrompt = () => updatePrompt(defaultPrompts[active])
  const generate = async () => {
    if (active !== 'quiz') {
      onUseTool(currentPrompt.trim())
      return
    }
    setQuizLoading(true)
    setQuizError('')
    try {
      const quiz = await toolsApi.createQuiz(spaceId, currentPrompt.trim())
      setQuizzes((items) => [quiz, ...items])
    } catch (error) {
      setQuizError(error.message)
    } finally {
      setQuizLoading(false)
    }
  }
  const deleteQuiz = async (event, quizId) => {
    event.stopPropagation()
    setQuizError('')
    try {
      await toolsApi.delete(quizId)
      setQuizzes((items) => items.filter((quiz) => quiz.id !== quizId))
    } catch (error) {
      setQuizError(error.message)
    }
  }

  if (openQuiz) return <QuizPlayer quiz={openQuiz} onExit={() => setOpenQuiz(null)} />

  return <aside className="flex h-full flex-col bg-[#f7f8f6]">
    <header className="border-b border-slate-200 bg-white px-5 py-4"><p className="text-[10px] font-bold tracking-[.18em] text-teal">LEARNING TOOLS</p><h2 className="mt-1 font-['Manrope'] text-sm font-bold text-ink">Study your way</h2></header>
    <div className="grid grid-cols-3 gap-2 p-4 lg:grid-cols-1 xl:grid-cols-3">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.id} onClick={() => setActive(tool.id)} className={`rounded-xl border p-3 text-left transition ${active === tool.id ? 'border-teal bg-white shadow-sm ring-2 ring-teal/10' : 'border-slate-200 bg-white/70 hover:border-slate-300'}`}><Icon size={18} className={active === tool.id ? 'text-teal' : 'text-slate-400'} /><p className="mt-2 text-xs font-semibold text-slate-700">{tool.name}</p></button> })}</div>
    <div className="mx-4 mb-4 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal"><Sparkles size={19} /></div><h3 className="mt-4 font-['Manrope'] text-base font-bold">{selected.name}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{selected.description}. ICU will generate it using only documents in the current Learning Space.</p>
      <div className="mt-5"><div className="mb-2 flex items-center justify-between"><label htmlFor={`prompt-${active}`} className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Custom prompt</label><button onClick={resetPrompt} title="Reset to default prompt" className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-teal"><RotateCcw size={11} />Reset</button></div><textarea id={`prompt-${active}`} value={currentPrompt} onChange={(event) => updatePrompt(event.target.value)} rows={6} maxLength={2000} placeholder={`Describe how ICU should generate your ${selected.name.toLowerCase()}...`} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/10" /><p className="mt-1 text-right text-[9px] text-slate-400">{currentPrompt.length}/2000</p></div>
      {quizError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-600">{quizError}</p>}
      <button disabled={disabled || quizLoading || !currentPrompt.trim()} onClick={generate} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{quizLoading && <LoaderCircle size={14} className="animate-spin" />}{quizLoading ? 'Loading...' : `Generate ${selected.name}`}</button>
      {active === 'quiz' && quizzes.length > 0 && <div className="mt-6 border-t border-slate-100 pt-4"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Saved quizzes</p><span className="text-[10px] text-slate-400">{quizzes.length}</span></div><div className="space-y-2">{quizzes.map((quiz) => <button key={quiz.id} onClick={() => setOpenQuiz(quiz)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-teal hover:bg-teal/[.03]"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal"><BrainCircuit size={15} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{quiz.title}</p><p className="mt-1 text-[10px] text-slate-400">{quiz.question_count} questions</p></div><span role="button" tabIndex={0} title="Delete quiz" onClick={(event) => deleteQuiz(event, quiz.id)} onKeyDown={(event) => { if (event.key === 'Enter') deleteQuiz(event, quiz.id) }} className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></span><ChevronRight size={14} className="text-slate-400" /></button>)}</div></div>}
    </div>
  </aside>
}
