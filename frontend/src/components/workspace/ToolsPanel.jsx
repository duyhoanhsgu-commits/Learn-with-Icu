import { BrainCircuit, LibraryBig, Network, Sparkles } from 'lucide-react'
import { useState } from 'react'

const tools = [
  { id: 'quiz', name: 'Quiz', description: 'Test your understanding', icon: BrainCircuit, prompt: 'Create a 10-question quiz from these documents.' },
  { id: 'mindmap', name: 'Mind map', description: 'Connect the key concepts', icon: Network, prompt: 'Create a structured mind map of the key concepts.' },
  { id: 'flashcards', name: 'Flashcards', description: 'Review important facts', icon: LibraryBig, prompt: 'Create flashcards for the most important ideas.' },
]

export default function ToolsPanel({ disabled, onUseTool }) {
  const [active, setActive] = useState('quiz')
  const selected = tools.find((tool) => tool.id === active)
  return <aside className="flex h-full flex-col bg-[#f7f8f6]"><header className="border-b border-slate-200 bg-white px-5 py-4"><p className="text-[10px] font-bold tracking-[.18em] text-teal">LEARNING TOOLS</p><h2 className="mt-1 font-['Manrope'] text-sm font-bold text-ink">Study your way</h2></header><div className="grid grid-cols-3 gap-2 p-4 lg:grid-cols-1 xl:grid-cols-3">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.id} onClick={() => setActive(tool.id)} className={`rounded-xl border p-3 text-left transition ${active === tool.id ? 'border-teal bg-white shadow-sm ring-2 ring-teal/10' : 'border-slate-200 bg-white/70 hover:border-slate-300'}`}><Icon size={18} className={active === tool.id ? 'text-teal' : 'text-slate-400'} /><p className="mt-2 text-xs font-semibold text-slate-700">{tool.name}</p></button> })}</div><div className="m-4 mt-0 rounded-2xl border border-slate-200 bg-white p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal"><Sparkles size={19} /></div><h3 className="mt-4 font-['Manrope'] text-base font-bold">{selected.name}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{selected.description}. ICU will generate it using only documents in the current Learning Space.</p><button disabled={disabled} onClick={() => onUseTool(selected.prompt)} className="mt-5 w-full rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Generate {selected.name}</button></div></aside>
}
