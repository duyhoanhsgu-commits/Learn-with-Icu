import { FileText, LoaderCircle } from 'lucide-react'

export default function FileItem({ file, active, onClick }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-teal/20 text-[#5ee2d3]' : 'bg-white/[0.06] text-slate-400'}`}>{file.status === 'uploading' ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}</div><div className="min-w-0"><p className={`truncate text-xs ${active ? 'font-medium text-white' : 'text-slate-200'}`}>{file.name}</p><p className="mt-1 text-[10px] uppercase text-slate-500">{file.status === 'uploading' ? 'Uploading...' : `${file.type} · ${file.size}`}</p></div></button>
}
