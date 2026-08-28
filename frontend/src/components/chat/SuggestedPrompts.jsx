import { Sparkles } from 'lucide-react'

export default function SuggestedPrompts({ prompts, onSelect, variant = 'scroll' }) {
  const landing = variant === 'landing'
  return <div className={`mx-auto mb-3 px-4 pb-1 sm:px-6 ${landing ? 'max-w-[820px]' : 'max-w-[760px]'}`}>{landing && <p className="mb-2 text-center text-[10px] font-semibold text-muted">Try these examples</p>}<div className={`flex gap-2 ${landing ? 'flex-wrap justify-center overflow-visible' : 'overflow-x-auto sm:flex-wrap'}`}>{prompts.map((prompt) => <button key={prompt} onClick={() => onSelect(prompt)} className={`flex shrink-0 items-center gap-2 border border-line bg-white px-3.5 py-2 text-[10px] font-medium text-muted transition hover:border-brandblue/30 hover:bg-brandblue/[.04] hover:text-ink ${landing ? 'rounded-full sm:text-[11px]' : 'rounded-full'}`}><Sparkles size={12} className="text-brandblue" />{prompt}</button>)}</div></div>
}
