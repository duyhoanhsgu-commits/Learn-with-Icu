import { BookOpen, Check, ChevronDown, FileText, ListFilter, PanelLeftClose, Plus, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import DocumentViewer from './DocumentViewer'
import FileItem from '../files/FileItem'
import FileUploadButton from '../files/FileUploadButton'

export default function DocumentsPanel({ spaces, activeSpace, onSelectSpace, onCreateSpace, onUpload, onDeleteFile, selectedFile, onSelectFile, sourceTarget, onAsk, onCollapse, onPersonalize }) {
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false)
  const spaceMenuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !spaceMenuRef.current?.contains(event.target))) {
        setSpaceMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [])

  const create = () => {
    const name = window.prompt('Learning space name')?.trim()
    if (name) onCreateSpace(name)
  }

  if (selectedFile) return <section className="relative h-full min-w-0 overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_4px_20px_rgba(15,23,42,.04)]"><DocumentViewer file={selectedFile} sourceTarget={sourceTarget} onExit={() => onSelectFile(null)} onAsk={onAsk} onCollapse={onCollapse} /></section>

  return <aside id="workspace-spaces-section" tabIndex={-1} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-line bg-white px-4 py-5 text-ink shadow-[0_4px_20px_rgba(15,23,42,.04)] sm:px-5">
    <div className="flex items-center justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted">Your library</p><h2 className="mt-1 font-['Manrope'] text-base font-bold">Learning Spaces</h2></div>
      <div className="flex items-center gap-1.5"><button onClick={create} title="New learning space" aria-label="Create learning space" className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brandblue/30 hover:bg-brandblue/[.05] hover:text-brandblue"><Plus size={17} /></button>{onCollapse && <button onClick={onCollapse} title="Collapse library" aria-label="Collapse library panel" className="hidden h-9 w-9 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brandblue/30 hover:bg-brandblue/[.05] hover:text-brandblue lg:grid"><PanelLeftClose size={17} /></button>}</div>
    </div>

    <div ref={spaceMenuRef} className="relative mt-5">
      <button type="button" aria-haspopup="listbox" aria-expanded={spaceMenuOpen} onClick={() => setSpaceMenuOpen((open) => !open)} className="relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-[18px] border border-brandblue/10 bg-brandblue/[.07] p-3.5 text-left transition hover:border-brandblue/20 hover:bg-brandblue/[.09]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brandblue shadow-sm ring-1 ring-brandblue/10"><BookOpen size={19} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.15em] text-brandblue/70">Active workspace</span><span className="mt-1 block truncate font-['Manrope'] text-sm font-bold text-ink">{activeSpace?.name || 'Select a space'}</span></span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-muted shadow-sm transition ${spaceMenuOpen ? 'rotate-180' : ''}`}><ChevronDown size={15} /></span>
      </button>

      {spaceMenuOpen && <div role="listbox" aria-label="Learning spaces" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white/95 p-2 shadow-[0_14px_32px_rgba(15,23,42,.12)] backdrop-blur-xl">
        <div className="px-2 pb-2 pt-1"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-muted">Switch workspace</p></div>
        {spaces.map((space) => {
          const selected = space.id === activeSpace?.id
          const dotColors = { blue: 'bg-brandblue', teal: 'bg-teal', violet: 'bg-violet', amber: 'bg-amber-400' }
          return <button key={space.id} role="option" aria-selected={selected} onClick={() => { onSelectSpace(space.id); setSpaceMenuOpen(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-brandblue/[.07]' : 'hover:bg-slate-50'}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColors[space.color] || 'bg-brandblue'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{space.name}</span><span className="mt-0.5 block text-[9px] text-muted">{space.files.length} {space.files.length === 1 ? 'document' : 'documents'}</span></span>{selected && <span className="grid h-6 w-6 place-items-center rounded-lg bg-brandblue/10 text-brandblue"><Check size={13} strokeWidth={2.5} /></span>}</button>
        })}
        {!spaces.length && <p className="px-3 py-5 text-center text-[10px] text-slate-500">No learning spaces yet.</p>}
      </div>}
    </div>

    <div id="workspace-documents-section" tabIndex={-1} className="mt-6 flex shrink-0 items-center justify-between border-b border-line pb-3"><div className="flex items-center gap-2"><FileText size={14} className="text-brandblue" /><p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">Documents</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-muted">{activeSpace?.files.length || 0}</span></div><button type="button" title="Document filters" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"><ListFilter size={14} /></button></div>

    <div role="region" aria-label="Documents in this learning space" tabIndex={0} className="document-list-scroll mt-3 min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain pb-2 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brandblue/40">{activeSpace?.files.map((file) => <FileItem key={file.id} file={file} active={false} onClick={() => file.persisted && onSelectFile(file.id)} onDelete={file.persisted ? onDeleteFile : undefined} />)}{activeSpace && !activeSpace.files.length && <div className="grid h-full min-h-32 place-items-center px-5 text-center"><div><FileText size={25} className="mx-auto text-slate-300" /><p className="mt-3 text-xs font-semibold text-ink">No documents yet</p><p className="mt-1 text-[10px] leading-4 text-muted">Upload your first learning material below.</p></div></div>}</div>

    {activeSpace && <div id="workspace-upload-section" tabIndex={-1} className="mt-4 shrink-0"><FileUploadButton onUpload={onUpload} /><p className="mt-2 text-center text-[9px] text-muted">PDF, Word, Markdown, text or JSON</p></div>}
    <button type="button" onClick={onPersonalize} className="mt-4 flex w-full shrink-0 items-center gap-3 rounded-2xl border border-line bg-slate-50/70 p-3 text-left transition hover:border-brandblue/20 hover:bg-brandblue/[.04]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brandblue shadow-sm ring-1 ring-line"><UserRound size={16} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink">Cá nhân hóa</span><span className="mt-0.5 block text-[9px] text-muted">Learning preferences</span></span><Settings size={15} className="text-slate-400" /></button>
  </aside>
}
