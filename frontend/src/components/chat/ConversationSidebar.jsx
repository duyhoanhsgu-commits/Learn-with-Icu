import { Clock3, MessageSquareText, MoreHorizontal, Plus, Settings, Trash2, UserRound, X } from 'lucide-react'
import { useState } from 'react'
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

export default function ConversationSidebar({ conversations, activeId, loading, error, open, disabled, desktopWidth = 286, onClose, onNew, onSelect, onDelete, onPersonalize }) {
  const [menuId, setMenuId] = useState(null)
  return <>
    <button type="button" onClick={onClose} aria-label="Close conversation history" className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} />
    <aside style={{ '--conversation-sidebar-width': `${desktopWidth}px` }} className={`fixed bottom-3 left-3 top-3 z-50 flex w-[286px] shrink-0 flex-col rounded-[24px] border border-line bg-white px-4 py-5 text-ink shadow-[0_12px_36px_rgba(15,23,42,.12)] transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-[var(--conversation-sidebar-width)] lg:translate-x-0 lg:shadow-[0_4px_20px_rgba(15,23,42,.04)] ${open ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]'}`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3"><BrandLogo className="h-10 w-10 rounded-xl border border-line bg-white p-0.5 shadow-sm" /><div><p className="font-['Manrope'] text-[17px] font-bold">ICU Tutor</p><p className="mt-0.5 text-[11px] text-muted">Conversation space</p></div></div>
        <button type="button" onClick={onClose} aria-label="Close conversation history" className="rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-ink lg:hidden"><X size={17} /></button>
      </div>

      <button type="button" onClick={onNew} disabled={disabled} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brandblue px-4 text-xs font-bold text-white transition hover:bg-[#426de8] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} strokeWidth={2.5} />New chat</button>

      <div className="mt-7 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-2"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-muted">Conversations</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-muted">{conversations.length}</span></div>
        <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {loading && <div className="space-y-2 px-1 py-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-[14px] bg-slate-100" />)}</div>}
          {!loading && error && <p className="rounded-[14px] border border-red-100 bg-red-50 px-3 py-3 text-[10px] leading-4 text-red-600">Could not load history: {error}</p>}
          {!loading && !error && !conversations.length && <div className="px-4 py-10 text-center"><MessageSquareText size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-[11px] font-semibold text-muted">No conversations yet</p><p className="mt-1 text-[9px] leading-4 text-slate-400">Start a new chat and it will appear here.</p></div>}
          {!loading && conversations.map((conversation) => {
            const active = conversation.id === activeId
            return <div key={conversation.id} className={`group relative rounded-[14px] border transition ${active ? 'border-brandblue/10 bg-brandblue/[.07]' : 'border-transparent hover:border-line hover:bg-slate-50'}`}>
              <button type="button" onClick={() => { setMenuId(null); onSelect(conversation.id) }} disabled={disabled} className="w-full px-3 py-3 pr-10 text-left disabled:cursor-not-allowed"><p className={`truncate text-[11px] font-semibold ${active ? 'text-ink' : 'text-slate-700'}`}>{conversation.title}</p><p className="mt-1 flex items-center gap-1 text-[8px] text-muted"><Clock3 size={9} />{relativeTime(conversation.updated_at)}</p></button>
              <button type="button" onClick={() => setMenuId((current) => current === conversation.id ? null : conversation.id)} disabled={disabled} aria-label={`Options for ${conversation.title}`} aria-expanded={menuId === conversation.id} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 opacity-60 transition hover:bg-white hover:text-ink focus:opacity-100 disabled:cursor-not-allowed group-hover:opacity-100"><MoreHorizontal size={14} /></button>
              {menuId === conversation.id && <div className="absolute right-2 top-[calc(50%+18px)] z-20 min-w-28 rounded-xl border border-line bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,.12)]"><button type="button" onClick={() => { setMenuId(null); onDelete(conversation.id) }} disabled={disabled} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed"><Trash2 size={12} />Delete</button></div>}
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-brandblue" />}
            </div>
          })}
        </div>
      </div>

      <button type="button" onClick={onPersonalize} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-slate-50/70 p-3 text-left transition hover:border-brandblue/20 hover:bg-brandblue/[.04]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brandblue shadow-sm ring-1 ring-line"><UserRound size={16} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink">Cá nhân hóa</span><span className="mt-0.5 block text-[9px] text-muted">Learning preferences</span></span><Settings size={15} className="text-slate-400" /></button>
    </aside>
  </>
}
