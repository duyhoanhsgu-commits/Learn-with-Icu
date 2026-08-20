import { Sparkles } from 'lucide-react'

export default function SuggestedPrompts({ prompts, onSelect }) {
  return <div className="mx-auto mb-3 flex max-w-[770px] gap-2 overflow-x-auto px-5 pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">{prompts.map((prompt) => <button key={prompt} onClick={() => onSelect(prompt)} className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] text-slate-600 shadow-sm transition hover:border-teal/30 hover:bg-[#f3faf8] hover:text-slate-900"><Sparkles size={13} className="text-teal" />{prompt}</button>)}</div>
}
