import { useRef, useState } from 'react'
import { FolderOpen, Upload } from 'lucide-react'
import FileSidebar from '../components/files/FileSidebar'
import ChatHeader from '../components/layout/ChatHeader'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import { filePrompts } from '../data/mockData'

const openingMessage = (space) => ({
  id: `open-${space.id}-${Date.now()}`,
  role: 'assistant',
  content: space.files.length
    ? `Welcome to “${space.name}”.\n\nI've loaded ${space.files.length} ${space.files.length === 1 ? 'document' : 'documents'} in this learning space. Ask across all of them, request a summary, or let me quiz you.`
    : `“${space.name}” is ready.\n\nUpload one or more documents to build the knowledge base for this learning space.`,
})

export default function LearnPage({ learningSpaces, setLearningSpaces, onNavigate }) {
  const [activeSpaceId, setActiveSpaceId] = useState(learningSpaces[0]?.id || null)
  const [messagesBySpace, setMessagesBySpace] = useState(() => Object.fromEntries(learningSpaces.map((space) => [space.id, [openingMessage(space)]])))
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const timerRef = useRef(null)
  const activeSpace = learningSpaces.find((space) => space.id === activeSpaceId) || null
  const messages = activeSpaceId ? (messagesBySpace[activeSpaceId] || []) : []
  const readyFiles = activeSpace?.files.filter((file) => file.status === 'ready') || []
  const uploading = activeSpace?.files.some((file) => file.status === 'uploading') || false

  const selectSpace = (spaceId) => {
    clearTimeout(timerRef.current)
    setIsTyping(false)
    setActiveSpaceId(spaceId)
    setDraft('')
    setSidebarOpen(false)
    const space = learningSpaces.find((item) => item.id === spaceId)
    if (space) setMessagesBySpace((all) => all[spaceId] ? all : { ...all, [spaceId]: [openingMessage(space)] })
  }

  const createSpace = (name) => {
    const colors = ['blue', 'teal', 'violet', 'amber']
    const space = { id: `space-${Date.now()}`, name, color: colors[learningSpaces.length % colors.length], files: [] }
    setLearningSpaces((items) => [...items, space])
    setMessagesBySpace((all) => ({ ...all, [space.id]: [openingMessage(space)] }))
    setActiveSpaceId(space.id)
    setDraft('')
  }

  const upload = (nativeFile) => {
    if (!activeSpace) return
    const spaceId = activeSpace.id
    const id = `file-${Date.now()}`
    const extension = nativeFile.name.split('.').pop()?.toLowerCase() || 'file'
    const file = {
      id,
      name: nativeFile.name,
      type: extension,
      size: nativeFile.size >= 1048576 ? `${(nativeFile.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(nativeFile.size / 1024))} KB`,
      status: 'uploading',
    }
    setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, files: [...space.files, file] } : space))
    setTimeout(() => {
      setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, files: space.files.map((item) => item.id === id ? { ...item, status: 'ready' } : item) } : space))
      setMessagesBySpace((all) => ({ ...all, [spaceId]: [...(all[spaceId] || []), { id: `uploaded-${id}`, role: 'assistant', content: `“${nativeFile.name}” is ready and has been added to this learning space.` }] }))
    }, 800)
  }

  const restart = () => {
    if (!activeSpace) return
    clearTimeout(timerRef.current)
    setIsTyping(false)
    setMessagesBySpace((all) => ({ ...all, [activeSpace.id]: [openingMessage(activeSpace)] }))
  }

  const send = () => {
    const content = draft.trim()
    if (!content || !activeSpace || !readyFiles.length || isTyping) return
    const space = activeSpace
    const sourceFile = readyFiles[0]
    setDraft('')
    setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), { id: crypto.randomUUID(), role: 'user', content }] }))
    setIsTyping(true)
    timerRef.current = setTimeout(() => {
      const reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Based on the documents in “${space.name}”, a base case is the condition that tells a recursive process when to stop. The answer is retrieved only from this learning space's ${space.files.length} ${space.files.length === 1 ? 'document' : 'documents'}.`,
        sources: [{ fileId: sourceFile.id, fileName: sourceFile.name, page: 12 }],
      }
      setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), reply] }))
      setIsTyping(false)
    }, 500)
  }

  const unavailable = !activeSpace || !readyFiles.length
  const placeholder = !activeSpace
    ? 'Select a learning space to begin'
    : !activeSpace.files.length
      ? 'Upload a file to start learning'
      : !readyFiles.length
        ? 'Your files are being prepared...'
        : `Ask anything in ${activeSpace.name}...`

  return <main className="flex h-screen overflow-hidden bg-canvas"><FileSidebar spaces={learningSpaces} activeSpace={activeSpace} onSelectSpace={selectSpace} onCreateSpace={createSpace} onUpload={upload} onGeneralChat={() => onNavigate('/chat')} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><section className="flex min-w-0 flex-1 flex-col"><ChatHeader title={activeSpace?.name || 'Learning Spaces'} subject={activeSpace ? `${readyFiles.length} ${readyFiles.length === 1 ? 'document' : 'documents'} in this knowledge space${uploading ? ' · Uploading...' : ''}` : 'Create or select a space'} onMenu={() => setSidebarOpen(true)} onRestart={restart} /><div className="min-h-0 flex-1 overflow-y-auto">{activeSpace ? <MessageList messages={messages} isTyping={isTyping} /> : <div className="grid h-full place-items-center px-6"><div className="max-w-md text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-navy text-white"><FolderOpen size={23} /></div><h2 className="font-['Manrope'] text-xl font-bold">Create your first learning space</h2><p className="mt-3 text-sm leading-6 text-slate-500">Keep subjects separate, upload a different set of documents to each space, and chat with only that knowledge base.</p></div></div>}</div><div className="shrink-0 border-t border-slate-200/70 bg-canvas pb-4 pt-3 sm:px-6 sm:pb-5">{activeSpace && !activeSpace.files.length ? <div className="mx-auto mb-3 flex max-w-[770px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 py-3 text-xs text-slate-500"><Upload size={15} className="text-teal" />Upload documents from the sidebar to activate this space</div> : <SuggestedPrompts prompts={filePrompts} onSelect={(prompt) => !unavailable && setDraft(prompt)} />}<ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={unavailable || isTyping} placeholder={placeholder} /></div></section></main>
}
