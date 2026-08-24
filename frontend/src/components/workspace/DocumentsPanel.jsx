import { BookOpen, ChevronDown, FileText, ListFilter, Plus } from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import FileItem from '../files/FileItem'
import FileUploadButton from '../files/FileUploadButton'

export default function DocumentsPanel({ spaces, activeSpace, onSelectSpace, onCreateSpace, onUpload, onDeleteFile, selectedFile, onSelectFile, onAsk }) {
  const create = () => {
    const name = window.prompt('Learning space name')?.trim()
    if (name) onCreateSpace(name)
  }

  if (selectedFile) return <section className="relative h-full min-w-0 overflow-hidden bg-white"><DocumentViewer file={selectedFile} onExit={() => onSelectFile(null)} onAsk={onAsk} /></section>

  return <aside className="flex h-full min-w-0 flex-col bg-midnight px-4 py-5 text-white sm:px-5">
    <div className="flex items-center justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal">Your library</p><h2 className="mt-1 font-['Manrope'] text-base font-bold">Learning Spaces</h2></div>
      <button onClick={create} title="New learning space" aria-label="Create learning space" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-slate-200 transition hover:border-teal/40 hover:bg-teal/15 hover:text-white"><Plus size={17} /></button>
    </div>

    <label className="icu-gradient relative mt-5 flex min-h-[78px] cursor-pointer items-center gap-3 overflow-hidden rounded-[18px] p-4 shadow-[0_12px_30px_rgba(18,184,170,.18)]">
      <span className="absolute -right-7 -top-8 h-24 w-24 rounded-full border border-white/15" />
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur"><BookOpen size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.15em] text-white/70">Active workspace</span><span className="mt-1 block truncate font-['Manrope'] text-sm font-bold">{activeSpace?.name || 'Select a space'}</span></span>
      <ChevronDown size={17} className="shrink-0 text-white/80" />
      <select aria-label="Active learning space" value={activeSpace?.id || ''} onChange={(event) => onSelectSpace(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0"><option value="" disabled>Select a space</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select>
    </label>

    <div className="mt-6 flex items-center justify-between border-b border-white/[0.08] pb-3"><div className="flex items-center gap-2"><FileText size={14} className="text-teal" /><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-300">Documents</p><span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] text-slate-400">{activeSpace?.files.length || 0}</span></div><button type="button" title="Document filters" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><ListFilter size={14} /></button></div>

    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">{activeSpace?.files.map((file) => <FileItem key={file.id} file={file} active={false} onClick={() => file.persisted && onSelectFile(file.id)} onDelete={file.persisted ? onDeleteFile : undefined} />)}{activeSpace && !activeSpace.files.length && <div className="grid h-full min-h-32 place-items-center px-5 text-center"><div><FileText size={25} className="mx-auto text-slate-600" /><p className="mt-3 text-xs font-semibold text-slate-300">No documents yet</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Upload your first learning material below.</p></div></div>}</div>

    {activeSpace && <div className="mt-4 shrink-0"><FileUploadButton onUpload={onUpload} /><p className="mt-2 text-center text-[9px] text-slate-600">PDF, Word, Markdown, text or JSON</p></div>}
  </aside>
}
