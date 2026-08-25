import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, FileText, Files, FolderOpen, HelpCircle, Layers3, PanelRight, RotateCcw, Sparkles, UserRound } from 'lucide-react'
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
import BrandLogo from '../components/common/BrandLogo'

const openingMessage = (space) => ({
  id: `open-${space.id}-${Date.now()}`,
  role: 'assistant',
  content: space.files.length
    ? `Welcome to “${space.name}”.\n\nI've loaded ${space.files.length} ${space.files.length === 1 ? 'document' : 'documents'} in this learning space. Ask across all of them, request a summary, or let me quiz you.`
    : `“${space.name}” is ready.\n\nUpload one or more documents to build the knowledge base for this learning space.`,
})

function WorkspaceWelcome({ space, files }) {
  const currentFile = files[0]
  return <div className="mx-auto flex h-full w-full max-w-[760px] flex-col items-center justify-center px-5 py-8 text-center sm:px-8">
    <BrandLogo className="h-14 w-14 rounded-2xl border border-line bg-white p-1.5 shadow-[0_12px_28px_rgba(52,133,245,.18)]" />
    <p className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-teal"><Sparkles size={13} />Learning assistant</p>
    <h3 className="mt-2 font-['Manrope'] text-xl font-bold tracking-tight text-ink sm:text-2xl">Welcome to your learning space.</h3>
    <p className="mt-3 max-w-md text-xs leading-6 text-muted">Ask across your uploaded materials, simplify difficult ideas, create summaries, or generate a study tool when you are ready.</p>
    <div className="mt-6 flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brandblue/10 text-brandblue"><FileText size={18} /></div>
      <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-muted">Your materials</p><p className="mt-1 truncate text-xs font-semibold text-ink">{currentFile?.name || 'No document selected'}</p></div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-muted"><Layers3 size={11} />{files.length} {files.length === 1 ? 'file' : 'files'}</div>
    </div>
    {!files.length && <p className="mt-4 text-[10px] font-medium text-amber-600">Upload a document from the Materials panel to begin.</p>}
  </div>
}

export default function LearnPage({ learningSpaces, setLearningSpaces, documentsState, onNavigate }) {
  const [activeSpaceId, setActiveSpaceId] = useState(learningSpaces[0]?.id || null)
  const [messagesBySpace, setMessagesBySpace] = useState(() => Object.fromEntries(learningSpaces.map((space) => [space.id, [openingMessage(space)]])))
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [sourceTarget, setSourceTarget] = useState(null)
  const [notice, setNotice] = useState(null)
  const [mobilePane, setMobilePane] = useState(null)
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
    setSourceTarget(null)
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
    const temporaryId = `upload-${crypto.randomUUID()}`
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

  const openSource = (source) => {
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
      return
    }
    const file = activeSpace?.files.find((item) => item.id === source.fileId)
    if (!file) {
      setNotice({ type: 'error', message: 'The source document is no longer available in this learning space.' })
      return
    }
    setSelectedFileId(file.id)
    setSourceTarget({ ...source, requestId: crypto.randomUUID() })
    setMobilePane('documents')
  }

  const selectFile = (fileId) => {
    setSelectedFileId(fileId)
    setSourceTarget(null)
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

  const chatPanel = <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-canvas">
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-white px-4 sm:px-6">
      <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Learning Chat</p><h2 className="mt-1 truncate font-['Manrope'] text-base font-bold text-ink">{activeSpace?.name || 'Learning Space'}</h2></div>
      <button onClick={restart} disabled={!activeSpace} title="Reset conversation" aria-label="Reset conversation" className="rounded-xl border border-line p-2.5 text-muted transition hover:border-teal/30 hover:bg-teal/[.05] hover:text-teal disabled:opacity-30"><RotateCcw size={15} /></button>
    </header>
    {(notice || documentsState.error) && <div className={`mx-4 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] sm:mx-6 ${notice?.type === 'success' && !documentsState.error ? 'border-teal/20 bg-teal/[.06] text-[#08786e]' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice?.type === 'success' && !documentsState.error ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span className="flex-1">{documentsState.error ? `API unavailable: ${documentsState.error}` : notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss notification" className="rounded p-1">×</button></div>}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">{activeSpace ? (messages.length <= 1 && !isTyping ? <WorkspaceWelcome space={activeSpace} files={readyFiles} /> : <MessageList messages={messages} isTyping={isTyping} onSourceClick={openSource} />) : <div className="grid h-full place-items-center px-6 text-center"><div><FolderOpen className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold">Create a Learning Space</p></div></div>}</div>
    <div className="shrink-0 border-t border-line bg-canvas pb-3 pt-3"><SuggestedPrompts prompts={filePrompts} onSelect={(prompt) => !unavailable && setDraft(prompt)} /><ChatInput value={draft} onChange={setDraft} onSubmit={send} disabled={unavailable || isTyping} placeholder={indexedFiles.length ? 'Ask anything about your materials…' : placeholder} /></div>
  </section>

  const documentsPanel = <DocumentsPanel spaces={learningSpaces} activeSpace={activeSpace} onSelectSpace={selectSpace} onCreateSpace={createSpace} onUpload={upload} onDeleteFile={deleteFile} selectedFile={selectedFile} onSelectFile={selectFile} sourceTarget={sourceTarget} onAsk={(question, excerpt, imageDataUrl) => send(excerpt ? `${question}\n\nSelected document excerpt:\n${excerpt}` : question, imageDataUrl)} />
  const toolsPanel = <ToolsPanel disabled={unavailable || isTyping} onUseTool={send} spaceId={activeSpace?.id} />

  return <main className="flex h-screen flex-col overflow-hidden bg-canvas">
    <nav className="flex h-[68px] shrink-0 items-center justify-between border-b border-line bg-white px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><BrandLogo className="h-9 w-9 rounded-xl border border-line bg-white p-0.5 shadow-sm" /><span className="truncate font-['Manrope'] text-sm font-bold text-ink">ICU Learning Workspace</span></div>
      <div className="flex items-center gap-1 sm:gap-2"><button onClick={() => setMobilePane('documents')} className="rounded-xl p-2.5 text-muted hover:bg-slate-50 hover:text-ink lg:hidden" aria-label="Open learning materials"><Files size={17} /></button><button onClick={() => setMobilePane('tools')} className="rounded-xl p-2.5 text-muted hover:bg-slate-50 hover:text-ink lg:hidden" aria-label="Open study tools"><PanelRight size={17} /></button><button title="Help" aria-label="Help" className="hidden rounded-xl p-2.5 text-muted hover:bg-slate-50 hover:text-ink sm:grid"><HelpCircle size={17} /></button><button onClick={() => onNavigate('/personalization')} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-muted transition hover:border-teal/30 hover:bg-teal/[.05] hover:text-teal sm:flex sm:w-auto sm:gap-2 sm:px-3" aria-label="Cá nhân hóa"><UserRound size={15} /><span className="hidden text-[11px] font-semibold sm:inline">Cá nhân hóa</span></button><button onClick={() => onNavigate('/chat')} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11px] font-semibold text-ink transition hover:border-brandblue/30 hover:bg-brandblue/[.04]"><span className="hidden sm:inline">General Chat</span><span className="sm:hidden">Chat</span><ChevronDown size={13} className="text-muted" /></button></div>
    </nav>
    <ResizableWorkspace left={documentsPanel} center={chatPanel} right={toolsPanel} mobilePane={mobilePane} onOpenMobilePane={setMobilePane} onCloseMobilePane={() => setMobilePane(null)} leftUnbounded={selectedFile?.type?.toLowerCase() === 'pdf'} leftRevealKey={sourceTarget?.requestId} />
  </main>
}
