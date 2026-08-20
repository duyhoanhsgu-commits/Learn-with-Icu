import { ArrowLeft, Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import FileUploadButton from './FileUploadButton'
import FileItem from './FileItem'
import LearningSpaceItem from './LearningSpaceItem'
import UserProfile from '../sidebar/UserProfile'

export default function FileSidebar({ spaces, activeSpace, onSelectSpace, onCreateSpace, onUpload, onGeneralChat, open, onClose }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const create = () => {
    const cleanName = name.trim()
    if (!cleanName) return
    onCreateSpace(cleanName)
    setName('')
    setCreating(false)
  }

  return <><div onClick={onClose} className={`fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm md:hidden ${open ? 'block' : 'hidden'}`} /><aside className={`fixed inset-y-0 left-0 z-40 flex w-[304px] shrink-0 flex-col bg-navy px-4 py-5 text-white transition-transform duration-300 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="mb-6 flex items-center justify-between px-1"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-teal text-xs font-bold">IC</div><span className="font-['Manrope'] text-[15px] font-bold">ICU Tutor</span></div><button onClick={onClose} aria-label="Close sidebar" className="p-1 text-slate-400 md:hidden"><X size={20} /></button></div><button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><Plus size={17} />New learning space</button>{creating && <div className="mt-2 flex gap-2"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); if (event.key === 'Escape') setCreating(false) }} placeholder="Space name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-teal" /><button onClick={create} aria-label="Create space" disabled={!name.trim()} className="grid w-9 place-items-center rounded-lg bg-teal text-white disabled:opacity-40"><Check size={16} /></button></div>}<div className="mt-6 min-h-0 flex-1 overflow-y-auto"><h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">LEARNING SPACES</h2><div className="space-y-1">{spaces.map((space) => <LearningSpaceItem key={space.id} space={space} active={activeSpace?.id === space.id} onClick={() => onSelectSpace(space.id)} />)}</div>{activeSpace && <div className="mt-6 border-t border-white/[0.08] pt-5"><div className="mb-3 flex items-center justify-between px-3"><h2 className="text-[10px] font-bold tracking-[0.18em] text-slate-500">FILES IN THIS SPACE</h2><span className="text-[10px] text-slate-600">{activeSpace.files.length}</span></div><FileUploadButton onUpload={onUpload} /><div className="mt-3 space-y-1">{activeSpace.files.length ? activeSpace.files.map((file) => <FileItem key={file.id} file={file} active={false} onClick={() => {}} />) : <p className="px-3 py-4 text-center text-[11px] leading-5 text-slate-500">No documents yet.<br />Upload the first file for this space.</p>}</div></div>}</div><button onClick={onGeneralChat} className="mb-4 mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white"><ArrowLeft size={15} />General Chat</button><UserProfile /></aside></>
}
