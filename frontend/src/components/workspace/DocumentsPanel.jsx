import { BookOpen, Check, ChevronDown, FileText, ListFilter, PanelLeftClose, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import DocumentViewer from './DocumentViewer'
import FileItem from '../files/FileItem'
import FileUploadButton from '../files/FileUploadButton'

export default function DocumentsPanel({ spaces, activeSpace, onSelectSpace, onCreateSpace, onUpload, onDeleteFile, selectedFile, onSelectFile, sourceTarget, onAsk, onCollapse }) {
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

  if (selectedFile) return <section className="relative h-full min-w-0 overflow-hidden bg-white"><DocumentViewer file={selectedFile} sourceTarget={sourceTarget} onExit={() => onSelectFile(null)} onAsk={onAsk} onCollapse={onCollapse} /></section>

  return <aside id="workspace-spaces-section" tabIndex={-1} className="flex h-full min-w-0 flex-col bg-midnight px-4 py-5 text-white sm:px-5">
    <div className="flex items-center justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal">Your library</p><h2 className="mt-1 font-['Manrope'] text-base font-bold">Learning Spaces</h2></div>
      <div className="flex items-center gap-1.5"><button onClick={create} title="New learning space" aria-label="Create learning space" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-slate-200 transition hover:border-teal/40 hover:bg-teal/15 hover:text-white"><Plus size={17} /></button>{onCollapse && <button onClick={onCollapse} title="Collapse library" aria-label="Collapse library panel" className="hidden h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-teal/40 hover:bg-teal/15 hover:text-white lg:grid"><PanelLeftClose size={17} /></button>}</div>
    </div>

    <div ref={spaceMenuRef} className="relative mt-5">
      <button type="button" aria-haspopup="listbox" aria-expanded={spaceMenuOpen} onClick={() => setSpaceMenuOpen((open) => !open)} className="icu-gradient relative flex min-h-[78px] w-full items-center gap-3 overflow-hidden rounded-[18px] p-4 text-left shadow-[0_12px_30px_rgba(18,184,170,.18)] transition hover:brightness-105">
        <span className="absolute -right-7 -top-8 h-24 w-24 rounded-full border border-white/15" />
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur"><BookOpen size={19} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.15em] text-white/70">Active workspace</span><span className="mt-1 block truncate font-['Manrope'] text-sm font-bold text-white">{activeSpace?.name || 'Select a space'}</span></span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-white/80 transition ${spaceMenuOpen ? 'rotate-180' : ''}`}><ChevronDown size={15} /></span>
      </button>

      {spaceMenuOpen && <div role="listbox" aria-label="Learning spaces" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-navy/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="px-2 pb-2 pt-1"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Switch workspace</p></div>
        {spaces.map((space) => {
          const selected = space.id === activeSpace?.id
          const dotColors = { blue: 'bg-brandblue', teal: 'bg-teal', violet: 'bg-violet', amber: 'bg-amber-400' }
          return <button key={space.id} role="option" aria-selected={selected} onClick={() => { onSelectSpace(space.id); setSpaceMenuOpen(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColors[space.color] || 'bg-teal'}`} /><span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold ${selected ? 'text-white' : 'text-slate-200'}`}>{space.name}</span><span className="mt-0.5 block text-[9px] text-slate-500">{space.files.length} {space.files.length === 1 ? 'document' : 'documents'}</span></span>{selected && <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal/15 text-teal"><Check size={13} strokeWidth={2.5} /></span>}</button>
        })}
        {!spaces.length && <p className="px-3 py-5 text-center text-[10px] text-slate-500">No learning spaces yet.</p>}
      </div>}
    </div>

    <div id="workspace-documents-section" tabIndex={-1} className="mt-6 flex items-center justify-between border-b border-white/[0.08] pb-3"><div className="flex items-center gap-2"><FileText size={14} className="text-teal" /><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-300">Documents</p><span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] text-slate-400">{activeSpace?.files.length || 0}</span></div><button type="button" title="Document filters" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><ListFilter size={14} /></button></div>

    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">{activeSpace?.files.map((file) => <FileItem key={file.id} file={file} active={false} onClick={() => file.persisted && onSelectFile(file.id)} onDelete={file.persisted ? onDeleteFile : undefined} />)}{activeSpace && !activeSpace.files.length && <div className="grid h-full min-h-32 place-items-center px-5 text-center"><div><FileText size={25} className="mx-auto text-slate-600" /><p className="mt-3 text-xs font-semibold text-slate-300">No documents yet</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Upload your first learning material below.</p></div></div>}</div>

    {activeSpace && <div id="workspace-upload-section" tabIndex={-1} className="mt-4 shrink-0"><FileUploadButton onUpload={onUpload} /><p className="mt-2 text-center text-[9px] text-slate-600">PDF, Word, Markdown, text or JSON</p></div>}
  </aside>
}
