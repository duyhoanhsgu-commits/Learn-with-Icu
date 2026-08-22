import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, LoaderCircle, ScanLine, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { documentContentUrl, documentTextUrl } from '../../api/documents'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function PdfViewer({ file, width }) {
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  return <div className="h-full overflow-y-auto bg-slate-200 pb-8 pt-16"><Document file={documentContentUrl(file.id)} loading={<div className="grid h-64 place-items-center"><LoaderCircle className="animate-spin text-teal" /></div>} onLoadSuccess={({ numPages }) => { setPages(numPages); setPage(1) }}><Page pageNumber={page} width={Math.max(280, width - 24)} renderTextLayer renderAnnotationLayer /></Document>{pages > 1 && <div className="sticky bottom-3 mx-auto mt-3 flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="font-semibold text-teal disabled:text-slate-300">Previous</button><span>{page} / {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="font-semibold text-teal disabled:text-slate-300">Next</button></div>}</div>
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
  else if (error) content = <div className="p-5 pt-16 text-sm text-red-600">{error}</div>
  else if (type === 'md' || type === 'markdown') content = <article className="document-markdown h-full overflow-y-auto p-6 pt-16"><ReactMarkdown>{text}</ReactMarkdown></article>
  else content = <div className="h-full overflow-y-auto bg-white p-6 pt-16"><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{text}</pre></div>

  return <div ref={viewerRef} onPointerDown={(event) => { if (!cropMode) pointerDown(event) }} onPointerUp={(event) => { if (!cropMode) pointerUp(event) }} className="relative h-full overflow-hidden">{content}<button onClick={onExit} className="absolute left-3 top-3 z-40 flex max-w-[55%] items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur hover:border-teal hover:text-teal"><ArrowLeft size={14} className="shrink-0" /><span className="truncate">Exit · {file.name}</span></button>{type === 'pdf' && <button onClick={() => { setCropMode((value) => !value); setAskBox(null); setCropRect(null) }} className={`absolute right-3 top-3 z-40 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur ${cropMode ? 'border-teal bg-teal text-white' : 'border-slate-200 bg-white/95 text-slate-700 hover:border-teal hover:text-teal'}`}><ScanLine size={15} />{cropMode ? 'Cancel capture' : 'Capture area'}</button>}{cropMode && <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} className="absolute inset-0 z-20 cursor-crosshair touch-none select-none"><div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy/90 px-4 py-2 text-[11px] font-semibold text-white shadow-lg">Click and drag to capture an area</div>{cropRect && <div style={cropRect} className="pointer-events-none absolute border-2 border-teal bg-teal/20 shadow-[0_0_0_9999px_rgba(15,23,42,.25)]"><span className="absolute -top-6 left-0 rounded bg-teal px-2 py-1 text-[9px] font-bold text-white">CAPTURE</span></div>}</div>}{askBox && <AskPopover position={askBox.position} excerpt={askBox.excerpt} imageDataUrl={askBox.imageDataUrl} onAsk={onAsk} onClose={() => setAskBox(null)} />}</div>
}
