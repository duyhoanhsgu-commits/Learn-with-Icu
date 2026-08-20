import { ChevronRight, Folder } from 'lucide-react'

const colors = {
  teal: 'bg-teal/20 text-[#5ee2d3]',
  violet: 'bg-violet-400/15 text-violet-300',
  amber: 'bg-amber-400/15 text-amber-300',
  blue: 'bg-blue-400/15 text-blue-300',
}

export default function LearningSpaceItem({ space, active, onClick }) {
  const ready = space.files.filter((file) => file.status === 'ready').length
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-white/10 ring-1 ring-white/[0.06]' : 'hover:bg-white/[0.06]'}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colors[space.color] || colors.blue}`}><Folder size={17} fill="currentColor" fillOpacity=".2" /></div><div className="min-w-0 flex-1"><p className={`truncate text-xs ${active ? 'font-semibold text-white' : 'font-medium text-slate-200'}`}>{space.name}</p><p className="mt-1 text-[10px] text-slate-500">{ready} {ready === 1 ? 'document' : 'documents'}</p></div><ChevronRight size={14} className={`shrink-0 transition ${active ? 'text-teal' : '-translate-x-1 text-slate-600'}`} /></button>
}
