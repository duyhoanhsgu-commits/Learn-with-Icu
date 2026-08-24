import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, LoaderCircle, ScanLine, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { documentContentUrl, documentTextUrl } from '../../api/documents'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function PdfViewer({ file, width }) {
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const availableWidth = width < 640 ? width - 56 : width < 1024 ? width - 112 : width - 160
  const pageWidth = Math.min(920, Math.max(280, availableWidth))

  return <div className="relative h-full bg-[#eef3fa]">
    <div className="h-full overflow-y-auto px-3 pb-28 pt-4">
      <Document className="pdf-reading-frame mx-auto w-fit overflow-hidden rounded-xl border border-white/80 bg-white p-2 shadow-[0_16px_40px_rgba(35,55,85,.14)]" file={documentContentUrl(file.id)} loading={<div className="grid h-64 w-[min(90vw,720px)] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-teal" /><p className="mt-3 text-xs text-muted">Preparing your document…</p></div></div>} onLoadSuccess={({ numPages }) => { setPages(numPages); setPage(1) }}><Page pageNumber={page} width={pageWidth} renderTextLayer renderAnnotationLayer /></Document>
    </div>
    {pages > 1 && <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-5"><div className="pointer-events-auto flex w-full max-w-[520px] items-center gap-2 rounded-2xl border border-line bg-white/95 p-2 shadow-[0_14px_38px_rgba(18,33,59,.16)] backdrop-blur-xl"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-[11px] font-semibold text-ink transition hover:border-teal/35 hover:bg-teal/[.05] hover:text-teal disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"><ChevronLeft size={15} />Previous</button><span className="shrink-0 px-2 text-center text-[10px] font-semibold text-muted sm:px-4">Page <strong className="font-bold text-ink">{page}</strong> of {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-[11px] font-semibold text-ink transition hover:border-teal/35 hover:bg-teal/[.05] hover:text-teal disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300">Next<ChevronRight size={15} /></button></div></div>}
  </div>
}

function AskPopover({ position, excerpt, imageDataUrl, onAsk, onClose }) {
  const [question, setQuestion] = useState('')
  const submit = (event) => {
    event.preventDefault()
    if (!question.trim()) return
    onAsk(question.trim(), excerpt, imageDataUrl)
    onClose()
  }
  return <form onSubmit={submit} style={{ left: position.x, top: position.y }} className="absolute z-50 w-[min(300px,calc(100%-24px))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.15em] text-teal">ASK AI</span><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={14} /></button></div>{imageDataUrl && <img src={imageDataUrl} alt="Captured document area" className="mb-2 max-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />}{excerpt && <p className="mb-2 line-clamp-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] leading-4 text-slate-500">“{excerpt}”</p>}<div className="flex gap-2"><input autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this..." className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal" /><button aria-label="Ask AI" disabled={!question.trim()} className="grid w-9 place-items-center rounded-lg bg-navy text-white disabled:bg-slate-200"><Send size={14} /></button></div></form>
}

export default function DocumentViewer({ file, onExit, onAsk }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [width, setWidth] = useState(400)
  const [askBox, setAskBox] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState(null)
  const dragStartRef = useRef(null)
  const viewerRef = useRef(null)
  const type = file?.type?.toLowerCase()

  useEffect(() => {
    if (!viewerRef.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(viewerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!file || type === 'pdf') return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(documentTextUrl(file.id))
      .then(async (response) => {
        if (!response.ok) throw new Error(`Preview failed (${response.status})`)
        return response.json()
      })
      .then((body) => { if (!cancelled) setText(body.text) })
      .catch((requestError) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [file?.id, type])

  const pointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button,input,form')) return
    const bounds = viewerRef.current.getBoundingClientRect()
    const canvas = cropMode
      ? document.elementsFromPoint(event.clientX, event.clientY).find((element) => element.tagName === 'CANVAS')
      : null
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      localX: event.clientX - bounds.left,
      localY: event.clientY - bounds.top,
      canvas,
    }
    if (cropMode) {
      event.currentTarget.setPointerCapture(event.pointerId)
      setAskBox(null)
      setCropRect({ left: event.clientX - bounds.left, top: event.clientY - bounds.top, width: 0, height: 0 })
    }
  }

  const pointerMove = (event) => {
    if (!cropMode || !dragStartRef.current) return
    const bounds = viewerRef.current.getBoundingClientRect()
    const currentX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const currentY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    const start = dragStartRef.current
    setCropRect({
      left: Math.min(start.localX, currentX),
      top: Math.min(start.localY, currentY),
      width: Math.abs(currentX - start.localX),
      height: Math.abs(currentY - start.localY),
    })
  }

  const pointerUp = (event) => {
    if (!dragStartRef.current || event.target.closest('button,input,form')) return
    const start = dragStartRef.current
    const selection = window.getSelection()?.toString().trim() || ''
    const distance = Math.hypot(event.clientX - dragStartRef.current.x, event.clientY - dragStartRef.current.y)
    dragStartRef.current = null
    const bounds = viewerRef.current.getBoundingClientRect()

    if (cropMode) {
      if (distance < 12 || !start.canvas) {
        setCropRect(null)
        return
      }
      const canvasBounds = start.canvas.getBoundingClientRect()
      const x1 = Math.max(Math.min(start.x, event.clientX), canvasBounds.left)
      const y1 = Math.max(Math.min(start.y, event.clientY), canvasBounds.top)
      const x2 = Math.min(Math.max(start.x, event.clientX), canvasBounds.right)
      const y2 = Math.min(Math.max(start.y, event.clientY), canvasBounds.bottom)
      if (x2 - x1 < 8 || y2 - y1 < 8) {
        setCropRect(null)
        return
      }
      const scaleX = start.canvas.width / canvasBounds.width
      const scaleY = start.canvas.height / canvasBounds.height
      const output = document.createElement('canvas')
      output.width = Math.round((x2 - x1) * scaleX)
      output.height = Math.round((y2 - y1) * scaleY)
      output.getContext('2d').drawImage(
        start.canvas,
        (x1 - canvasBounds.left) * scaleX,
        (y1 - canvasBounds.top) * scaleY,
        output.width,
        output.height,
        0,
        0,
        output.width,
        output.height,
      )
      setAskBox({
        excerpt: '',
        imageDataUrl: output.toDataURL('image/jpeg', 0.85),
        position: {
          x: Math.min(Math.max(event.clientX - bounds.left, 160), bounds.width - 160),
          y: Math.min(Math.max(event.clientY - bounds.top + 12, 70), bounds.height - 125),
        },
      })
      setCropRect(null)
      setCropMode(false)
      return
    }

    if (!selection) return
    setAskBox({
      excerpt: selection.slice(0, 3000),
      imageDataUrl: null,
      position: {
        x: Math.min(Math.max(event.clientX - bounds.left, 160), bounds.width - 160),
        y: Math.min(Math.max(event.clientY - bounds.top + 12, 70), bounds.height - 125),
      },
    })
  }

  if (!file) return <div className="grid h-full place-items-center bg-slate-50 px-6 text-center"><div><FileText className="mx-auto text-slate-300" size={34} /><p className="mt-3 text-sm font-semibold text-slate-600">Select a document</p><p className="mt-1 text-xs text-slate-400">PDF, Word and Markdown previews appear here.</p></div></div>
  let content
  if (type === 'pdf') content = <PdfViewer file={file} width={width} />
  else if (loading) content = <div className="grid h-full place-items-center"><LoaderCircle className="animate-spin text-teal" /></div>
  else if (error) content = <div className="grid h-full place-items-center bg-[#eef3fa] p-5 text-sm text-red-600">{error}</div>
  else if (type === 'md' || type === 'markdown') content = <div className="h-full overflow-y-auto bg-[#eef3fa] p-3"><article className="document-markdown mx-auto min-h-full rounded-xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(35,55,85,.12)]"><ReactMarkdown>{text}</ReactMarkdown></article></div>
  else content = <div className="h-full overflow-y-auto bg-[#eef3fa] p-3"><div className="mx-auto min-h-full rounded-xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(35,55,85,.12)]"><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{text}</pre></div></div>

  return <div ref={viewerRef} onPointerDown={(event) => { if (!cropMode) pointerDown(event) }} onPointerUp={(event) => { if (!cropMode) pointerUp(event) }} className="tool-page relative flex h-full min-w-0 flex-col overflow-hidden bg-[#eef3fa]">
    <header className="relative z-40 flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-line bg-white/95 px-3 shadow-[0_4px_18px_rgba(18,33,59,.04)] backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-2"><button onClick={onExit} aria-label="Back to documents" title="Back to documents" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-teal/35 hover:bg-teal/[.05] hover:text-teal"><ArrowLeft size={16} /></button><div className="min-w-0"><p className="truncate font-['Manrope'] text-[11px] font-bold text-ink">{file.name}</p><span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-wide text-muted">{file.type} · {file.size}</span></div></div>
      {type === 'pdf' && <button title={cropMode ? 'Cancel capture' : 'Capture area'} aria-label={cropMode ? 'Cancel capture' : 'Capture area'} onClick={() => { setCropMode((value) => !value); setAskBox(null); setCropRect(null) }} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold transition ${cropMode ? 'border-teal bg-teal text-white shadow-[0_7px_18px_rgba(18,184,170,.2)]' : 'border-line bg-white text-ink hover:border-teal/40 hover:bg-teal/[.05] hover:text-teal'}`}><ScanLine size={14} /><span className="hidden 2xl:inline">{cropMode ? 'Cancel' : 'Capture'}</span></button>}
    </header>
    <main className="relative min-h-0 flex-1">{content}</main>
    {cropMode && <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} className="absolute inset-0 z-[35] cursor-crosshair touch-none select-none"><div className="pointer-events-none absolute left-1/2 top-[72px] z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-navy/95 px-3 py-2 text-center text-[9px] font-semibold text-white shadow-[0_10px_28px_rgba(11,25,48,.25)]"><span className="block">Drag to select for ICU</span><span className="mt-0.5 block text-[8px] font-normal text-slate-300">Release to confirm</span></div>{cropRect && <div style={cropRect} className="pointer-events-none absolute border-2 border-teal bg-teal/15 shadow-[0_0_0_9999px_rgba(11,25,48,.32)]"><span className="absolute -top-6 left-0 rounded-md bg-teal px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-white">Release to confirm</span></div>}</div>}
    {askBox && <AskPopover position={askBox.position} excerpt={askBox.excerpt} imageDataUrl={askBox.imageDataUrl} onAsk={onAsk} onClose={() => setAskBox(null)} />}
  </div>
}
