import { X } from 'lucide-react'
import NewSessionButton from '../sidebar/NewSessionButton'
import RecentSessions from '../sidebar/RecentSessions'
import ModuleList from '../sidebar/ModuleList'
import UserProfile from '../sidebar/UserProfile'

export default function Sidebar({ sessions, modules, activeId, onSelect, onNew, open, onClose }) {
  return <><div onClick={onClose} className={`fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm md:hidden ${open ? 'block' : 'hidden'}`} /><aside className={`fixed inset-y-0 left-0 z-40 flex w-[288px] shrink-0 flex-col bg-navy px-4 py-5 text-white transition-transform duration-300 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="mb-6 flex items-center justify-between px-1"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-teal text-xs font-bold tracking-tight">IC</div><span className="font-['Manrope'] text-[15px] font-bold tracking-tight">ICU Tutor</span></div><button onClick={onClose} aria-label="Close sidebar" className="p-1 text-slate-400 md:hidden"><X size={20} /></button></div><NewSessionButton onClick={onNew} /><div className="min-h-0 flex-1 overflow-y-auto"><RecentSessions sessions={sessions} activeId={activeId} onSelect={onSelect} /><ModuleList modules={modules} /></div><UserProfile /></aside></>
}
