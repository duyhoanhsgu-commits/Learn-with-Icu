import { Sparkles } from 'lucide-react'

export default function SuggestedPrompts({ prompts, onSelect }) {
  return <div className="mx-auto mb-3 flex max-w-[760px] gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:px-6">{prompts.map((prompt) => <button key={prompt} onClick={() => onSelect(prompt)} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[10px] font-medium text-muted shadow-sm transition hover:border-teal/40 hover:bg-teal/[.05] hover:text-ink"><Sparkles size={12} className="text-teal" />{prompt}</button>)}</div>
}
