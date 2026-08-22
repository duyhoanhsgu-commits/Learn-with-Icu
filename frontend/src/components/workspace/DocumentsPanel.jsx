import { Plus } from 'lucide-react'
import DocumentViewer from './DocumentViewer'
import FileItem from '../files/FileItem'
import FileUploadButton from '../files/FileUploadButton'

export default function DocumentsPanel({ spaces, activeSpace, onSelectSpace, onCreateSpace, onUpload, onDeleteFile, selectedFile, onSelectFile, onAsk }) {
  const create = () => {
    const name = window.prompt('Learning space name')?.trim()
    if (name) onCreateSpace(name)
  }
  if (selectedFile) return <section className="relative h-full min-w-0 overflow-hidden border-r border-slate-200 bg-white"><DocumentViewer file={selectedFile} onExit={() => onSelectFile(null)} onAsk={onAsk} /></section>

  return <section className="flex h-full min-w-0 flex-col border-r border-slate-200 bg-navy p-4 text-white"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-teal">DOCUMENTS</p><h2 className="mt-1 truncate font-['Manrope'] text-sm font-bold">{activeSpace?.name || 'Learning Space'}</h2></div><button onClick={create} title="New learning space" className="rounded-lg bg-white/10 p-2 text-slate-200 hover:bg-white/20"><Plus size={16} /></button></div><select value={activeSpace?.id || ''} onChange={(event) => onSelectSpace(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white outline-none"><option value="" disabled>Select a space</option>{spaces.map((space) => <option className="text-slate-900" key={space.id} value={space.id}>{space.name}</option>)}</select>{activeSpace && <div className="mt-3"><FileUploadButton onUpload={onUpload} /></div>}<div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">{activeSpace?.files.map((file) => <FileItem key={file.id} file={file} active={false} onClick={() => file.persisted && onSelectFile(file.id)} onDelete={file.persisted ? onDeleteFile : undefined} />)}{activeSpace && !activeSpace.files.length && <p className="py-8 text-center text-[11px] text-slate-400">Upload the first document.</p>}</div></section>
}
