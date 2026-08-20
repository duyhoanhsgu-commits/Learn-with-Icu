import { Settings } from 'lucide-react'

export default function UserProfile() {
  return <div className="flex items-center gap-3 border-t border-white/10 px-1 pt-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/20 text-xs font-semibold text-[#5ee2d3]">MK</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-white">Mina Kobayashi</p><p className="mt-0.5 truncate text-[10px] text-slate-500">Year 2 · Liberal Arts</p></div><button aria-label="Settings" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"><Settings size={16} /></button></div>
}
