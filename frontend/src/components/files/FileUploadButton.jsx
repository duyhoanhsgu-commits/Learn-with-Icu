import { CloudUpload } from 'lucide-react'
import { useRef, useState } from 'react'

export default function FileUploadButton({ onUpload }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const acceptFiles = (fileList) => {
    Array.from(fileList || []).forEach((file) => onUpload(file))
  }
  return <><button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files) }} className={`group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition ${dragging ? 'border-teal bg-teal/10' : 'border-white/20 bg-white/[0.045] hover:border-teal/60 hover:bg-white/[0.075]'}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-teal transition group-hover:-translate-y-0.5 group-hover:bg-teal/15"><CloudUpload size={19} /></span><span className="mt-3 text-xs font-bold text-white">Upload files</span><span className="mt-1 text-[10px] leading-4 text-slate-400">Drag multiple files or use Ctrl / Cmd to select</span></button><input ref={inputRef} type="file" multiple accept=".pdf,.txt,.md,.json,.docx" className="hidden" onChange={(event) => { acceptFiles(event.target.files); event.target.value = '' }} /></>
}
