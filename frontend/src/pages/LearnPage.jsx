import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FolderOpen, Upload } from 'lucide-react'
import FileSidebar from '../components/files/FileSidebar'
import ChatHeader from '../components/layout/ChatHeader'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import { filePrompts } from '../data/mockData'
import { documentsApi, toFrontendFile } from '../api/documents'
import { askQuestion, toFrontendSources } from '../api/chat'
import { spacesApi } from '../api/spaces'

const openingMessage = (space) => ({
  id: `open-${space.id}-${Date.now()}`,
  role: 'assistant',
  content: space.files.length
    ? `Welcome to “${space.name}”.\n\nI've loaded ${space.files.length} ${space.files.length === 1 ? 'document' : 'documents'} in this learning space. Ask across all of them, request a summary, or let me quiz you.`
    : `“${space.name}” is ready.\n\nUpload one or more documents to build the knowledge base for this learning space.`,
})

export default function LearnPage({ learningSpaces, setLearningSpaces, documentsState, onNavigate }) {
  const [activeSpaceId, setActiveSpaceId] = useState(learningSpaces[0]?.id || null)
  const [messagesBySpace, setMessagesBySpace] = useState(() => Object.fromEntries(learningSpaces.map((space) => [space.id, [openingMessage(space)]])))
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const timerRef = useRef(null)
  const sessionIdsRef = useRef({})
  const activeSpace = learningSpaces.find((space) => space.id === activeSpaceId) || null
  const messages = activeSpaceId ? (messagesBySpace[activeSpaceId] || []) : []
  const readyFiles = activeSpace?.files.filter((file) => file.status === 'ready') || []
  const indexedFiles = readyFiles.filter((file) => file.persisted)
  const uploading = activeSpace?.files.some((file) => file.status === 'uploading') || false

  useEffect(() => {
    if (!activeSpaceId && learningSpaces.length) {
      const first = learningSpaces[0]
      setActiveSpaceId(first.id)
      setMessagesBySpace((all) => all[first.id] ? all : { ...all, [first.id]: [openingMessage(first)] })
    }
  }, [activeSpaceId, learningSpaces])

  const selectSpace = (spaceId) => {
    clearTimeout(timerRef.current)
    setIsTyping(false)
    setActiveSpaceId(spaceId)
    setDraft('')
    setSidebarOpen(false)
    const space = learningSpaces.find((item) => item.id === spaceId)
    if (space) setMessagesBySpace((all) => all[spaceId] ? all : { ...all, [spaceId]: [openingMessage(space)] })
  }

  const createSpace = async (name) => {
    const colors = ['blue', 'teal', 'violet', 'amber']
    try {
      const created = await spacesApi.create(name, colors[learningSpaces.length % colors.length])
      const space = { ...created, files: [] }
      setLearningSpaces((items) => [...items, space])
      setMessagesBySpace((all) => ({ ...all, [space.id]: [openingMessage(space)] }))
      setActiveSpaceId(space.id)
      setDraft('')
      setNotice({ type: 'success', message: `${space.name} created.` })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const updateFile = (spaceId, fileId, updater) => {
    setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId
      ? { ...space, files: space.files.map((file) => file.id === fileId ? updater(file) : file) }
      : space))
  }

  const pollDocument = (spaceId, documentId, attempts = 0) => {
    if (attempts >= 30) return
    setTimeout(async () => {
      try {
        const document = await documentsApi.get(documentId)
        const file = toFrontendFile(document)
        updateFile(spaceId, documentId, () => file)
        if (file.status === 'uploading') pollDocument(spaceId, documentId, attempts + 1)
        if (file.status === 'ready') {
          setNotice({ type: 'success', message: `${file.name} is ready.` })
          setMessagesBySpace((all) => ({ ...all, [spaceId]: [...(all[spaceId] || []), { id: `uploaded-${documentId}`, role: 'assistant', content: `“${file.name}” is ready and has been added to this learning space.` }] }))
        }
      } catch (error) {
        setNotice({ type: 'error', message: error.message })
      }
    }, 1000)
  }

  const upload = async (nativeFile) => {
    if (!activeSpace) return
    const spaceId = activeSpace.id
    const extension = nativeFile.name.split('.').pop()?.toLowerCase() || 'file'
    const temporaryId = `upload-${Date.now()}`
    const temporaryFile = {
      id: temporaryId,
      name: nativeFile.name,
      type: extension,
      size: nativeFile.size >= 1048576 ? `${(nativeFile.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(nativeFile.size / 1024))} KB`,
      status: 'uploading',
    }
    setNotice(null)
    setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, files: [...space.files, temporaryFile] } : space))
    try {
      const { document } = await documentsApi.upload(nativeFile, spaceId)
      const persistedFile = toFrontendFile(document)
      setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, files: space.files.map((file) => file.id === temporaryId ? persistedFile : file) } : space))
      setNotice({ type: 'success', message: `${nativeFile.name} uploaded. Processing started.` })
      if (persistedFile.status === 'uploading') pollDocument(spaceId, persistedFile.id)
    } catch (error) {
      setLearningSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, files: space.files.filter((file) => file.id !== temporaryId) } : space))
      setNotice({ type: 'error', message: error.message })
    }
  }

  const deleteFile = async (file) => {
    if (!activeSpace || !window.confirm(`Delete “${file.name}”? This also removes its indexed data.`)) return
    const spaceId = activeSpace.id
    setNotice(null)
    try {
      await documentsApi.remove(file.id)
      setLearningSpaces((spaces) => spaces.map((space) => ({ ...space, files: space.files.filter((item) => item.id !== file.id) })))
      setNotice({ type: 'success', message: `${file.name} deleted.` })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const restart = () => {
    if (!activeSpace) return
    clearTimeout(timerRef.current)
    delete sessionIdsRef.current[activeSpace.id]
    setIsTyping(false)
    setMessagesBySpace((all) => ({ ...all, [activeSpace.id]: [openingMessage(activeSpace)] }))
  }

  const send = async () => {
    const content = draft.trim()
    if (!content || !activeSpace || !indexedFiles.length || isTyping) return
    const space = activeSpace
    const sessionId = sessionIdsRef.current[space.id] || crypto.randomUUID()
    sessionIdsRef.current[space.id] = sessionId
    setDraft('')
    setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), { id: crypto.randomUUID(), role: 'user', content }] }))
    setIsTyping(true)
    try {
      const response = await askQuestion({ question: content, sessionId, spaceId: space.id })
      const reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: toFrontendSources(response.sources),
      }
      setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), reply] }))
    } catch (error) {
      setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), {
        id: crypto.randomUUID(),
        role: 'error',
        content: `Unable to reach ICU Tutor: ${error.message}`,
      }] }))
    } finally {
      setIsTyping(false)
    }
  }

  const unavailable = !activeSpace || !indexedFiles.length
  const placeholder = !activeSpace
    ? 'Select a learning space to begin'
    : !activeSpace.files.length
      ? 'Upload a file to start learning'
      : !indexedFiles.length
        ? 'Your files are being prepared...'
        : `Ask anything in ${activeSpace.name}...`

  return <main className="flex h-screen overflow-hidden bg-canvas"><FileSidebar spaces={learningSpaces} activeSpace={activeSpace} onSelectSpace={selectSpace} onCreateSpace={createSpace} onUpload={upload} onDeleteFile={deleteFile} onGeneralChat={() => onNavigate('/chat')} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><section className="relative flex min-w-0 flex-1 flex-col"><ChatHeader title={activeSpace?.name || 'Learning Spaces'} subject={activeSpace ? `${readyFiles.length} ${readyFiles.length === 1 ? 'document' : 'documents'} in this knowledge space${uploading ? ' · Processing...' : ''}` : 'Create or select a space'} onMenu={() => setSidebarOpen(true)} onRestart={restart} />{(notice || documentsState.error) && <div className={`mx-auto mt-3 flex w-[calc(100%-2.5rem)] max-w-[770px] items-center gap-2 rounded-lg border px-3 py-2 text-xs ${notice?.type === 'success' && !documentsState.error ? 'border-teal/20 bg-[#edf9f6] text-[#08786e]' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice?.type === 'success' && !documentsState.error ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span className="flex-1">{documentsState.error ? `Document API unavailable: ${documentsState.error}` : notice.message}</span><button onClick={() => setNotice(null)} className="text-current opacity-60 hover:opacity-100">×</button></div>}<div className="min-h-0 flex-1 overflow-y-auto">{activeSpace ? <MessageList messages={messages} isTyping={isTyping} /> : <div className="grid h-full place-items-center px-6"><div className="max-w-md text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-navy text-white"><FolderOpen size={23} /></div><h2 className="font-['Manrope'] text-xl font-bold">Create your first learning space</h2><p className="mt-3 text-sm leading-6 text-slate-500">Keep subjects separate, upload a different set of documents to each space, and chat with only that knowledge base.</p></div></div>}</div><div className="shrink-0 border-t border-slate-200/70 bg-canvas pb-4 pt-3 sm:px-6 sm:pb-5">{activeSpace && !activeSpace.files.length ? <div className="mx-auto mb-3 flex max-w-[770px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 py-3 text-xs text-slate-500"><Upload size={15} className="text-teal" />Upload documents from the sidebar to activate this space</div> : <SuggestedPrompts prompts={filePrompts} onSelect={(prompt) => !unavailable && setDraft(prompt)} />}<ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={unavailable || isTyping} placeholder={placeholder} /></div></section></main>
}
