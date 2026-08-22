import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, FolderOpen, RotateCcw, Upload } from 'lucide-react'
import MessageList from '../components/chat/MessageList'
import SuggestedPrompts from '../components/chat/SuggestedPrompts'
import ChatInput from '../components/chat/ChatInput'
import { filePrompts } from '../data/mockData'
import { documentsApi, toFrontendFile } from '../api/documents'
import { askQuestion, toFrontendSources } from '../api/chat'
import { spacesApi } from '../api/spaces'
import ResizableWorkspace from '../components/workspace/ResizableWorkspace'
import DocumentsPanel from '../components/workspace/DocumentsPanel'
import ToolsPanel from '../components/workspace/ToolsPanel'

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
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [notice, setNotice] = useState(null)
  const timerRef = useRef(null)
  const sessionIdsRef = useRef({})
  const activeSpace = learningSpaces.find((space) => space.id === activeSpaceId) || null
  const messages = activeSpaceId ? (messagesBySpace[activeSpaceId] || []) : []
  const readyFiles = activeSpace?.files.filter((file) => file.status === 'ready') || []
  const indexedFiles = readyFiles.filter((file) => file.persisted)
  const uploading = activeSpace?.files.some((file) => file.status === 'uploading') || false
  const selectedFile = activeSpace?.files.find((file) => file.id === selectedFileId) || null

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
    setSelectedFileId(null)
    setDraft('')
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

  const send = async (preparedPrompt = '', imageDataUrl = null) => {
    const content = (preparedPrompt || draft).trim()
    if (!content || !activeSpace || !indexedFiles.length || isTyping) return
    const space = activeSpace
    const sessionId = sessionIdsRef.current[space.id] || crypto.randomUUID()
    sessionIdsRef.current[space.id] = sessionId
    setDraft('')
    setMessagesBySpace((all) => ({ ...all, [space.id]: [...(all[space.id] || []), { id: crypto.randomUUID(), role: 'user', content }] }))
    setIsTyping(true)
    try {
      const response = await askQuestion({ question: content, sessionId, spaceId: space.id, imageDataUrl })
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

  const chatPanel = <section className="flex h-full min-w-0 flex-col bg-canvas"><header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4"><div className="min-w-0"><p className="text-[10px] font-bold tracking-[.18em] text-teal">SPACE CHAT</p><h2 className="mt-1 truncate font-['Manrope'] text-sm font-bold">{activeSpace?.name || 'Learning Space'}</h2></div><button onClick={restart} disabled={!activeSpace} title="Restart chat" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal disabled:opacity-30"><RotateCcw size={16} /></button></header>{(notice || documentsState.error) && <div className={`m-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${notice?.type === 'success' && !documentsState.error ? 'border-teal/20 bg-[#edf9f6] text-[#08786e]' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice?.type === 'success' && !documentsState.error ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span className="flex-1">{documentsState.error ? `API unavailable: ${documentsState.error}` : notice.message}</span><button onClick={() => setNotice(null)}>×</button></div>}<div className="min-h-0 flex-1 overflow-y-auto">{activeSpace ? <MessageList messages={messages} isTyping={isTyping} /> : <div className="grid h-full place-items-center px-6 text-center"><div><FolderOpen className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold">Create a Learning Space</p></div></div>}</div><div className="shrink-0 border-t border-slate-200 bg-canvas pb-3 pt-3">{activeSpace && !activeSpace.files.length ? <div className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-xs text-slate-500"><Upload size={15} className="text-teal" />Upload a document to begin</div> : <SuggestedPrompts prompts={filePrompts} onSelect={(prompt) => !unavailable && setDraft(prompt)} />}<ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={unavailable || isTyping} placeholder={placeholder} /></div></section>

  return <main className="flex h-screen flex-col overflow-hidden bg-canvas"><div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4"><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-[9px] font-bold text-white">IC</div><span className="font-['Manrope'] text-sm font-bold">ICU Learning Workspace</span></div><button onClick={() => onNavigate('/chat')} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-teal"><ArrowLeft size={14} />General Chat</button></div><ResizableWorkspace left={<DocumentsPanel spaces={learningSpaces} activeSpace={activeSpace} onSelectSpace={selectSpace} onCreateSpace={createSpace} onUpload={upload} onDeleteFile={deleteFile} selectedFile={selectedFile} onSelectFile={setSelectedFileId} onAsk={(question, excerpt, imageDataUrl) => send(excerpt ? `${question}\n\nSelected document excerpt:\n${excerpt}` : question, imageDataUrl)} />} center={chatPanel} right={<ToolsPanel disabled={unavailable || isTyping} onUseTool={send} />} /></main>
}
