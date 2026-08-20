import { FileText } from 'lucide-react'

export default function FileInfo({ file }) {
  if (!file) return null
  return <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[10px] text-slate-400"><FileText size={13} className="text-teal" /><span className="truncate">{file.type.toUpperCase()} · {file.size} · {file.status === 'ready' ? 'Ready' : 'Uploading'}</span></div>
}
