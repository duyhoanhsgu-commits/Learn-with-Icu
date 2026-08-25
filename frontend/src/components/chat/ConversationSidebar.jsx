import { Clock3, MessageSquareText, Plus, Trash2, X } from 'lucide-react'
import BrandLogo from '../common/BrandLogo'

function relativeTime(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ConversationSidebar({ conversations, activeId, loading, error, open, disabled, onClose, onNew, onSelect, onDelete }) {
  return <>
    <button type="button" onClick={onClose} aria-label="Close conversation history" className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[286px] shrink-0 flex-col border-r border-white/[.07] bg-midnight px-4 py-5 text-white shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3"><BrandLogo className="h-9 w-9 rounded-xl border border-white/10 bg-white p-0.5" /><div><p className="font-['Manrope'] text-sm font-bold">ICU Tutor</p><p className="mt-0.5 text-[9px] text-slate-500">Conversation space</p></div></div>
        <button type="button" onClick={onClose} aria-label="Close conversation history" className="rounded-lg p-2 text-slate-500 hover:bg-white/[.07] hover:text-white lg:hidden"><X size={17} /></button>
      </div>

      <button type="button" onClick={onNew} disabled={disabled} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-xs font-bold text-white shadow-[0_8px_22px_rgba(18,184,170,.2)] transition hover:bg-[#0ca698] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} strokeWidth={2.5} />New chat</button>

      <div className="mt-7 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-2"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">Conversations</p><span className="text-[9px] text-slate-600">{conversations.length}</span></div>
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {loading && <div className="space-y-2 px-1 py-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-white/[.05]" />)}</div>}
          {!loading && error && <p className="rounded-xl border border-red-400/10 bg-red-400/[.06] px-3 py-3 text-[10px] leading-4 text-red-200">Could not load history: {error}</p>}
          {!loading && !error && !conversations.length && <div className="px-4 py-10 text-center"><MessageSquareText size={24} className="mx-auto text-slate-600" /><p className="mt-3 text-[11px] font-semibold text-slate-400">No conversations yet</p><p className="mt-1 text-[9px] leading-4 text-slate-600">Start a new chat and it will appear here.</p></div>}
          {!loading && conversations.map((conversation) => {
            const active = conversation.id === activeId
            return <div key={conversation.id} className={`group relative rounded-xl transition ${active ? 'bg-white/[.1]' : 'hover:bg-white/[.055]'}`}>
              <button type="button" onClick={() => onSelect(conversation.id)} disabled={disabled} className="w-full px-3 py-3 pr-10 text-left disabled:cursor-not-allowed"><p className={`truncate text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{conversation.title}</p><p className="mt-1 flex items-center gap-1 text-[8px] text-slate-600"><Clock3 size={9} />{relativeTime(conversation.updated_at)}</p></button>
              <button type="button" onClick={() => onDelete(conversation.id)} disabled={disabled} aria-label={`Delete ${conversation.title}`} title="Delete conversation" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-600 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 focus:opacity-100 disabled:cursor-not-allowed group-hover:opacity-100"><Trash2 size={13} /></button>
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-teal" />}
            </div>
          })}
        </div>
      </div>
    </aside>
  </>
}
