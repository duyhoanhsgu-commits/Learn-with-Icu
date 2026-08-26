import { AlignLeft, BrainCircuit, Eye, X } from 'lucide-react'
import { useState } from 'react'

const DEFAULT_CONTEXT_TOKEN_LIMIT = 128000

const formatTokens = (tokens) => tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}K` : String(tokens)

export default function ContextWindowBar({ tokenCount = 0, tokenLimit = DEFAULT_CONTEXT_TOKEN_LIMIT, contextItems = [], canSummarize, disabled, summarizing, onSummary }) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const activeCount = Math.min(tokenCount, tokenLimit)
  const usage = (activeCount / tokenLimit) * 100
  const remaining = Math.max(0, tokenLimit - tokenCount)

  return <><div className="mx-auto mb-3 w-full max-w-[900px] px-4 sm:px-6">
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-slate-50/70 px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brandblue shadow-sm ring-1 ring-line"><BrainCircuit size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold text-ink">Context window</p><span className="shrink-0 text-[9px] font-medium text-muted">{formatTokens(activeCount)} / {formatTokens(tokenLimit)} tokens</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-brandblue transition-all" style={{ width: `${usage}%` }} /></div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => setViewerOpen(true)} disabled={!tokenCount} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[10px] font-semibold text-ink transition hover:border-brandblue/30 hover:bg-brandblue/[.04] hover:text-brandblue disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><Eye size={13} /><span className="hidden sm:inline">View</span></button>
        <button type="button" onClick={onSummary} disabled={disabled || !canSummarize} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[10px] font-semibold text-ink transition hover:border-brandblue/30 hover:bg-brandblue/[.04] hover:text-brandblue disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><AlignLeft size={13} />{summarizing ? 'Summarizing…' : 'Summary'}</button>
      </div>
    </div>
  </div>
  {viewerOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerOpen(false) }}>
    <section role="dialog" aria-modal="true" aria-label="Current context window" className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div><p className="text-sm font-bold text-ink">Current context window</p><p className="mt-1 text-[11px] text-muted">The information currently available to ICU Tutor.</p></div>
        <button type="button" onClick={() => setViewerOpen(false)} aria-label="Close context viewer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"><X size={16} /></button>
      </header>
      <div className="grid grid-cols-3 gap-2 border-b border-line bg-slate-50/70 px-5 py-3 sm:px-6">
        <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Used</p><p className="mt-1 text-xs font-bold text-ink">{formatTokens(tokenCount)}</p></div>
        <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Remaining</p><p className="mt-1 text-xs font-bold text-ink">{formatTokens(remaining)}</p></div>
        <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Usage</p><p className="mt-1 text-xs font-bold text-ink">{usage.toFixed(1)}%</p></div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
        {contextItems.length ? contextItems.map((item, index) => <article key={`${item.kind}-${index}`} className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-brandblue">{item.kind === 'summary' ? 'Context summary' : item.role === 'user' ? 'You' : 'ICU Tutor'}</span><span className="text-[9px] font-medium text-muted">{formatTokens(item.token_count)} tokens</span></div>
          <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{item.content}</p>
        </article>) : <p className="py-8 text-center text-xs text-muted">No active context yet.</p>}
      </div>
    </section>
  </div> : null}</>
}
