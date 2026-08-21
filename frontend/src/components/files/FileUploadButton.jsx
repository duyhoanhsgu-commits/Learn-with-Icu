import { Plus } from 'lucide-react'
import { useRef } from 'react'

export default function FileUploadButton({ onUpload }) {
  const inputRef = useRef(null)
  return <><button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b8d81]"><Plus size={17} strokeWidth={2.5} />Upload file</button><input ref={inputRef} type="file" accept=".pdf,.txt,.md,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = '' }} /></>
}
