import { FileText } from 'lucide-react'

export default function SourceReference({ source }) {
  return <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm"><FileText size={14} className="shrink-0 text-teal" /><span className="truncate font-medium text-slate-600">{source.fileName}</span>{source.page && <span className="shrink-0">· Page {source.page}</span>}</div>
}
