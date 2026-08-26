import { Check, Code2, Copy, FileText, PanelRightClose, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function parseAssistantOutput(messages) {
  const latest = [...messages].reverse().find((message) => message.role === 'assistant')
  const content = latest?.content || ''
  const blocks = []
  const pattern = /```([^\n`]*)\n?([\s\S]*?)```/g
  let match
  while ((match = pattern.exec(content))) {
    blocks.push({ language: match[1].trim() || 'text', code: match[2].trim() })
  }
  return {
    text: content.replace(pattern, '').trim(),
    blocks,
  }
}

export default function TutorOutputPanel({ messages, width, mobileOpen, onCloseMobile, onCollapse }) {
  const output = useMemo(() => parseAssistantOutput(messages), [messages])
  const [tab, setTab] = useState('text')
  const [blockIndex, setBlockIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBlockIndex(0)
    setTab(output.blocks.length && !output.text ? 'code' : 'text')
  }, [output])

  const currentCode = output.blocks[blockIndex]?.code || ''
  const copy = async () => {
    const value = tab === 'code' ? currentCode : output.text
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return <>
    <button type="button" onClick={onCloseMobile} aria-label="Close output panel" className={`fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm xl:hidden ${mobileOpen ? 'block' : 'hidden'}`} />
    <aside style={{ '--tutor-output-width': `${width}px` }} className={`fixed bottom-3 right-3 top-3 z-50 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-line bg-white text-ink shadow-[0_12px_36px_rgba(15,23,42,.14)] transition-transform xl:static xl:z-auto xl:h-full xl:w-[var(--tutor-output-width)] xl:translate-x-0 xl:shadow-[0_4px_20px_rgba(15,23,42,.04)] ${mobileOpen ? 'translate-x-0' : 'translate-x-[calc(100%+24px)]'}`}>
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brandblue/[.08] text-brandblue"><Sparkles size={16} /></span><div className="min-w-0"><h2 className="truncate text-xs font-bold">Output workspace</h2><p className="mt-0.5 text-[9px] text-muted">Text and code preview</p></div></div>
        <button type="button" onClick={() => { onCloseMobile(); onCollapse() }} aria-label="Close output workspace" title="Close workspace" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-slate-100 hover:text-ink"><PanelRightClose size={16} /></button>
      </header>

      <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2.5">
        <button type="button" onClick={() => setTab('text')} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold ${tab === 'text' ? 'bg-brandblue/[.09] text-brandblue' : 'text-muted hover:bg-slate-100 hover:text-ink'}`}><FileText size={13} />Text</button>
        <button type="button" onClick={() => setTab('code')} disabled={!output.blocks.length} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${tab === 'code' ? 'bg-brandblue/[.09] text-brandblue' : 'text-muted hover:bg-slate-100 hover:text-ink'}`}><Code2 size={13} />Code {output.blocks.length ? `(${output.blocks.length})` : ''}</button>
        <button type="button" onClick={copy} disabled={tab === 'code' ? !currentCode : !output.text} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-slate-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35" aria-label="Copy output" title="Copy output">{copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!output.text && !output.blocks.length ? <div className="grid h-full min-h-56 place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Code2 size={20} /></span><p className="mt-4 text-xs font-semibold text-ink">Nothing to preview yet</p><p className="mx-auto mt-1 max-w-52 text-[10px] leading-5 text-muted">Text and code from the latest ICU Tutor answer will appear here.</p></div></div> : tab === 'text' ? <div className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{output.text || 'This response only contains code. Open the Code tab to view it.'}</div> : <div>
          {output.blocks.length > 1 && <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">{output.blocks.map((block, index) => <button type="button" key={`${block.language}-${index}`} onClick={() => setBlockIndex(index)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${blockIndex === index ? 'border-brandblue/20 bg-brandblue/[.07] text-brandblue' : 'border-line text-muted hover:bg-slate-50'}`}>{block.language} {index + 1}</button>)}</div>}
          <div className="overflow-x-auto rounded-2xl bg-[#111827] p-4"><div className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-slate-400">{output.blocks[blockIndex]?.language || 'code'}</div><pre className="min-w-max whitespace-pre text-[11px] leading-5 text-slate-200"><code>{currentCode}</code></pre></div>
        </div>}
      </div>
    </aside>
  </>
}
