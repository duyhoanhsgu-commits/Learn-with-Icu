import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import hljs from 'highlight.js/lib/common'
import Editor from 'react-simple-code-editor'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import {
  Braces, Check, Code2, Copy, Download, FileCode2, FileText,
  GripHorizontal, PanelRightClose, Play, RotateCcw, Sigma,
  Sparkles, Square, Terminal, Undo2, Workflow,
} from 'lucide-react'
import { formatJsonArtifact, isRunnableArtifact } from '../../utils/artifacts'

const iconByType = {
  markdown: FileText,
  code: Code2,
  html: FileCode2,
  latex: Sigma,
  mermaid: Workflow,
  json: Braces,
  text: FileText,
}

function CodePreview({ content, language }) {
  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) return hljs.highlight(content, { language }).value
      return hljs.highlightAuto(content).value
    } catch {
      return content.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])
    }
  }, [content, language])
  return <div className="artifact-code h-full overflow-auto bg-[#111827] p-4"><pre className="min-w-max text-[11px] leading-5 text-slate-100"><code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} /></pre></div>
}

function SourceEditor({ value, language, onChange }) {
  const highlight = (source) => {
    try {
      if (language && hljs.getLanguage(language)) return hljs.highlight(source, { language }).value
      return hljs.highlightAuto(source).value
    } catch {
      return source.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])
    }
  }

  return <div className="h-full overflow-auto bg-[#111827]">
    <Editor
      value={value}
      onValueChange={onChange}
      highlight={highlight}
      padding={16}
      tabSize={2}
      insertSpaces
      aria-label={`Edit ${language || 'artifact'} source`}
      textareaClassName="!outline-none !caret-[#ff8a1f] selection:!bg-brandblue/35"
      preClassName="!m-0 !bg-transparent"
      style={{
        minHeight: '100%',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        lineHeight: '20px',
      }}
    />
  </div>
}

function MermaidPreview({ content }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      setSvg('')
      setError('')
      try {
        const module = await import('mermaid')
        const mermaid = module.default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            primaryColor: '#fff4ea',
            primaryBorderColor: '#ff6b00',
            primaryTextColor: '#111827',
            lineColor: '#98a2b3',
            fontFamily: 'Inter, sans-serif',
          },
        })
        const id = `artifact-mermaid-${crypto.randomUUID().replaceAll('-', '')}`
        const result = await mermaid.render(id, content)
        if (!cancelled) setSvg(result.svg)
      } catch (renderError) {
        if (!cancelled) setError(renderError.message || 'Unable to render this Mermaid diagram.')
      }
    }
    render()
    return () => { cancelled = true }
  }, [content])
  if (error) return <div className="m-4 rounded-xl border border-red-100 bg-red-50 p-4 text-xs leading-5 text-red-600">{error}</div>
  if (!svg) return <div className="grid h-full min-h-32 place-items-center text-xs text-muted">Rendering diagram…</div>
  return <div className="artifact-mermaid m-4 overflow-auto rounded-[14px] border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: svg }} />
}

const htmlPolicy = "default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; media-src data: blob:;"

function runnableHtml(artifact) {
  if (artifact.type === 'html') {
    const policy = `<meta http-equiv="Content-Security-Policy" content="${htmlPolicy}">`
    return /<head[\s>]/i.test(artifact.content)
      ? artifact.content.replace(/<head([^>]*)>/i, `<head$1>${policy}`)
      : `${policy}${artifact.content}`
  }
  const css = artifact.content.replace(/<\/style/gi, '<\\/style')
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${htmlPolicy}"><style>body{font-family:Inter,system-ui,sans-serif;margin:0;padding:28px;color:#111827;background:#fff}.preview-root{max-width:720px;margin:auto}${css}</style></head><body><main class="preview-root"><h1>CSS Preview</h1><p>This sample canvas shows the generated stylesheet.</p><button type="button">Sample button</button><div class="card"><strong>Sample card</strong><p>Use class selectors to style this content.</p></div></main></body></html>`
}

function BrowserPreview({ artifact }) {
  return <iframe title={`${artifact.title} output`} sandbox="allow-scripts" srcDoc={runnableHtml(artifact)} className="h-full min-h-0 w-full border-0 bg-white" />
}

function JavaScriptRunner({ artifact }) {
  const workerRef = useRef(null)
  const timeoutRef = useRef(null)
  const [runKey, setRunKey] = useState(0)
  const [status, setStatus] = useState('running')
  const [lines, setLines] = useState([])

  const stop = (nextStatus = 'stopped') => {
    workerRef.current?.terminate()
    workerRef.current = null
    window.clearTimeout(timeoutRef.current)
    setStatus(nextStatus)
  }

  useEffect(() => {
    setLines([])
    setStatus('running')
    if (/\bimport\s*(?:\(|[\s{*])/.test(artifact.content)) {
      setLines([{ level: 'error', text: 'Module imports are disabled in the browser sandbox.' }])
      setStatus('failed')
      return undefined
    }
    const source = `
      const blocked = () => Promise.reject(new Error('Network access is disabled in this sandbox.'));
      self.fetch = blocked; self.XMLHttpRequest = undefined; self.WebSocket = undefined;
      self.EventSource = undefined; self.importScripts = () => { throw new Error('Imports are disabled.'); };
      const format = (value) => { try { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch { return String(value); } };
      const send = (level, values) => self.postMessage({ type: 'output', level, text: values.map(format).join(' ') });
      console = { log: (...v) => send('log', v), info: (...v) => send('info', v), warn: (...v) => send('warn', v), error: (...v) => send('error', v) };
      self.onunhandledrejection = (event) => send('error', [event.reason?.stack || event.reason]);
      (async () => { try { const result = await eval(${JSON.stringify(artifact.content)}); if (result !== undefined) send('result', [result]); self.postMessage({ type: 'done' }); } catch (error) { send('error', [error?.stack || error]); self.postMessage({ type: 'failed' }); } })();
    `
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const worker = new Worker(url)
    workerRef.current = worker
    worker.onmessage = ({ data }) => {
      if (data.type === 'output') setLines((items) => [...items, data])
      if (data.type === 'done') stop('completed')
      if (data.type === 'failed') stop('failed')
    }
    worker.onerror = (event) => {
      setLines((items) => [...items, { level: 'error', text: event.message }])
      stop('failed')
    }
    timeoutRef.current = window.setTimeout(() => {
      setLines((items) => [...items, { level: 'error', text: 'Execution stopped after the 5 second limit.' }])
      stop('timed out')
    }, 5000)
    return () => {
      worker.terminate()
      URL.revokeObjectURL(url)
      window.clearTimeout(timeoutRef.current)
    }
  }, [artifact.content, runKey])

  return <div className="flex h-full min-h-0 flex-col bg-[#111827] text-slate-200">
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3"><div className="flex items-center gap-2 text-[10px] font-semibold"><Terminal size={13} className="text-brandblue" /><span className={`rounded-full px-2 py-0.5 text-[8px] uppercase ${status === 'running' ? 'bg-amber-400/15 text-amber-300' : status === 'completed' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>{status}</span></div><div className="flex gap-1">{status === 'running' && <button type="button" onClick={() => stop()} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] text-slate-300 hover:bg-white/10"><Square size={10} />Stop</button>}<button type="button" onClick={() => { stop(); setRunKey((value) => value + 1) }} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] text-slate-300 hover:bg-white/10"><RotateCcw size={10} />Run again</button></div></div>
    <div className="min-h-0 flex-1 space-y-2 overflow-auto p-4 font-mono text-[11px] leading-5">{lines.length ? lines.map((line, index) => <div key={index} className={line.level === 'error' ? 'text-red-300' : line.level === 'warn' ? 'text-amber-300' : line.level === 'result' ? 'text-emerald-300' : 'text-slate-200'}><span className="mr-2 select-none text-slate-600">›</span>{line.text}</div>) : <p className="text-slate-500">{status === 'running' ? 'Running…' : 'No console output.'}</p>}</div>
  </div>
}

function readLatexCommand(source, command) {
  const start = source.search(new RegExp(`\\\\${command}\\s*\\{`))
  if (start < 0) return ''
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{' && source[index - 1] !== '\\') depth += 1
    if (source[index] === '}' && source[index - 1] !== '\\') depth -= 1
    if (depth === 0) return source.slice(open + 1, index)
  }
  return ''
}

function replaceSimpleLatexCommands(value) {
  let output = value
  for (let pass = 0; pass < 4; pass += 1) {
    output = output
      .replace(/\\textbf\{([^{}]*)\}/g, '**$1**')
      .replace(/\\emph\{([^{}]*)\}|\\textit\{([^{}]*)\}/g, '*$1*')
      .replace(/\\texttt\{([^{}]*)\}/g, '`$1`')
      .replace(/\\underline\{([^{}]*)\}/g, '$1')
  }
  return output
}

function latexDocument(content) {
  const documentMatch = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)
  if (!documentMatch) {
    const formula = /\$|\\\[|\\\(/.test(content) ? content : `$$\n${content}\n$$`
    return { title: '', author: '', date: '', markdown: formula }
  }

  const title = readLatexCommand(content, 'title')
  const author = readLatexCommand(content, 'author')
  const rawDate = readLatexCommand(content, 'date')
  const date = rawDate === '\\today' ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date()) : rawDate
  let markdown = documentMatch[1]
    .replace(/%.*$/gm, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\(?:sub)*section\*?\{([^{}]*)\}/g, (_, heading) => `\n## ${heading}\n`)
    .replace(/\\paragraph\*?\{([^{}]*)\}/g, (_, heading) => `\n### ${heading}\n`)
    .replace(/\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\1\}/g, (_, environment, formula) => `\n$$\n${formula.trim()}\n$$\n`)
    .replace(/\\\[/g, '\n$$\n')
    .replace(/\\\]/g, '\n$$\n')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\begin\{(?:center|flushleft|flushright)\}|\\end\{(?:center|flushleft|flushright)\}/g, '')
    .replace(/\\(?:newpage|clearpage|pagebreak)\b/g, '\n---\n')
    .replace(/\\(?:vspace|hspace)\*?\{[^{}]*\}/g, '')
    .trim()
  markdown = replaceSimpleLatexCommands(markdown)
  return { title, author, date, markdown }
}

function LatexPreview({ content, previewRef }) {
  const document = useMemo(() => latexDocument(content), [content])
  return <div className="h-full overflow-auto bg-slate-200/70 p-4 sm:p-6"><article ref={previewRef} className="artifact-markdown mx-auto min-h-full w-full max-w-[760px] bg-white px-8 py-10 text-slate-900 shadow-[0_4px_18px_rgba(15,23,42,.12)] sm:px-12">
    {(document.title || document.author || document.date) && <header className="mb-10 border-b border-slate-200 pb-7 text-center">{document.title && <h1 className="text-xl font-bold leading-8">{document.title}</h1>}{document.author && <p className="mt-3 text-sm text-slate-600">{document.author}</p>}{document.date && <p className="mt-1 text-xs text-slate-400">{document.date}</p>}</header>}
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{document.markdown}</ReactMarkdown>
  </article></div>
}

function ResultPreview({ artifact, running, latexPreviewRef }) {
  if (running && (artifact.type === 'html' || artifact.language === 'css')) return <BrowserPreview artifact={artifact} />
  if (running) return <JavaScriptRunner artifact={artifact} />
  if (artifact.type === 'html') return <iframe title={artifact.title} sandbox="" srcDoc={artifact.content} className="h-full min-h-0 w-full border-0 bg-white" />
  if (artifact.type === 'mermaid') return <MermaidPreview content={artifact.content} />
  if (artifact.type === 'json') return <CodePreview content={formatJsonArtifact(artifact.content)} language="json" />
  if (artifact.type === 'latex') return <LatexPreview content={artifact.content} previewRef={latexPreviewRef} />
  if (artifact.type === 'markdown') return <article className="assistant-markdown artifact-markdown h-full overflow-auto bg-white p-5"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{artifact.content}</ReactMarkdown></article>
  if (artifact.type === 'code') return <div className="grid h-full place-items-center bg-white px-6 text-center"><div><Code2 className="mx-auto text-slate-300" size={22} /><p className="mt-3 text-xs font-semibold text-slate-700">Preview only</p><p className="mt-1 text-[10px] leading-5 text-muted">This language needs a separate secure runtime before it can run.</p></div></div>
  return <div className="h-full overflow-auto whitespace-pre-wrap break-words bg-white p-5 text-sm leading-7 text-slate-700">{artifact.content}</div>
}

function PaneHeader({ icon: Icon, title, detail, children }) {
  return <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-white px-3"><div className="flex min-w-0 items-center gap-2"><Icon size={13} className="shrink-0 text-brandblue" /><span className="text-[10px] font-semibold text-ink">{title}</span>{detail && <span className="truncate text-[8px] uppercase tracking-[.12em] text-muted">{detail}</span>}</div>{children}</div>
}

export default function TutorOutputPanel({ artifact, width, mobileOpen, onCloseMobile, onCollapse }) {
  const workspaceRef = useRef(null)
  const latexPreviewRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [splitPercent, setSplitPercent] = useState(45)
  const [pdfFeedback, setPdfFeedback] = useState('')
  const [draftContent, setDraftContent] = useState(artifact?.content || '')
  const [previewContent, setPreviewContent] = useState(artifact?.content || '')
  const Icon = artifact ? (iconByType[artifact.type] || Sparkles) : Sparkles
  const running = artifact?.mode === 'run' && isRunnableArtifact(artifact)
  const edited = Boolean(artifact && draftContent !== artifact.content)
  const workingArtifact = artifact ? { ...artifact, content: previewContent } : null

  const copy = async () => {
    if (!draftContent) return
    await navigator.clipboard.writeText(draftContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const startSplitResize = (event) => {
    event.preventDefault()
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds) return
    const divider = event.currentTarget
    divider.setPointerCapture?.(event.pointerId)
    const previousCursor = document.body.style.cursor
    const previousSelection = document.body.style.userSelect
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    const move = (moveEvent) => {
      const next = ((moveEvent.clientY - bounds.top) / bounds.height) * 100
      setSplitPercent(Math.min(75, Math.max(22, next)))
    }
    const finish = () => {
      if (divider.hasPointerCapture?.(event.pointerId)) divider.releasePointerCapture(event.pointerId)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelection
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
  }

  const exportPdf = () => {
    if (!latexPreviewRef.current) return
    const printWindow = window.open('', '_blank', 'width=900,height=1100')
    if (!printWindow) {
      setPdfFeedback('Allow pop-ups to export PDF.')
      return
    }
    printWindow.opener = null
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join('')
    printWindow.document.write(`<!doctype html><html><head><base href="${window.location.origin}/"><title>${artifact.title}</title>${styles}<style>@page{size:A4;margin:18mm}body{margin:0;background:#fff;color:#111827}.pdf-document{box-shadow:none!important;max-width:none!important;min-height:0!important;padding:0!important}</style></head><body><main class="pdf-document artifact-markdown">${latexPreviewRef.current.innerHTML}</main></body></html>`)
    printWindow.document.close()
    setPdfFeedback('Print dialog opened — choose Save as PDF.')
    const print = () => {
      printWindow.focus()
      printWindow.print()
    }
    if (printWindow.document.fonts?.ready) printWindow.document.fonts.ready.then(print, print)
    else window.setTimeout(print, 500)
  }

  useEffect(() => {
    setCopied(false)
    setPdfFeedback('')
    setDraftContent(artifact?.content || '')
    setPreviewContent(artifact?.content || '')
  }, [artifact?.content, artifact?.id])

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewContent(draftContent), 350)
    return () => window.clearTimeout(timer)
  }, [draftContent])

  return <>
    <button type="button" onClick={onCloseMobile} aria-label="Close artifact panel" className={`fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm xl:hidden ${mobileOpen ? 'block' : 'hidden'}`} />
    <aside style={{ '--tutor-output-width': `${width}px` }} className={`artifact-panel-responsive fixed bottom-3 right-3 top-3 z-50 flex w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden rounded-[18px] border border-line bg-white text-ink shadow-[0_12px_36px_rgba(15,23,42,.10)] transition-transform xl:static xl:z-auto xl:h-full xl:translate-x-0 xl:shadow-[var(--shadow-sm)] ${mobileOpen ? 'translate-x-0' : 'translate-x-[calc(100%+24px)]'}`}>
      <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brandblue/[.08] text-brandblue">{running ? <Play size={16} /> : <Icon size={16} />}</span><div className="min-w-0"><h2 className="truncate text-xs font-semibold">Artifact workspace</h2><p className="mt-0.5 truncate text-[9px] text-muted">{artifact ? `${running ? 'Running' : 'Previewing'} ${artifact.title}` : 'Contextual preview'}</p></div></div>
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={copy} disabled={!artifact} aria-label="Copy artifact" className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold text-muted transition hover:bg-brandblue/[.06] hover:text-brandblue disabled:opacity-30">{copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button><button type="button" onClick={() => { onCloseMobile(); onCollapse() }} aria-label="Close artifact workspace" title="Close workspace" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-slate-100 hover:text-ink"><PanelRightClose size={16} /></button></div>
      </header>

      {artifact ? <div ref={workspaceRef} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas/60">
        <section style={{ height: `${splitPercent}%` }} className="flex min-h-0 shrink-0 flex-col">
          <PaneHeader icon={Code2} title="Source" detail={`${artifact.language || artifact.type} · editable`}><div className="flex items-center gap-2">{edited && <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-amber-600">Edited</span>}<button type="button" onClick={() => setDraftContent(artifact.content)} disabled={!edited} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold text-muted hover:bg-slate-100 hover:text-ink disabled:cursor-default disabled:opacity-30"><Undo2 size={11} />Reset</button></div></PaneHeader>
          <div className="min-h-0 flex-1 overflow-hidden"><SourceEditor value={draftContent} language={artifact.language} onChange={setDraftContent} /></div>
        </section>

        <div role="separator" aria-label="Resize source and output" aria-orientation="horizontal" aria-valuemin={22} aria-valuemax={75} aria-valuenow={Math.round(splitPercent)} tabIndex={0} onPointerDown={startSplitResize} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); setSplitPercent((value) => Math.max(22, value - 4)) } if (event.key === 'ArrowDown') { event.preventDefault(); setSplitPercent((value) => Math.min(75, value + 4)) } }} className="group relative grid h-3 shrink-0 cursor-row-resize touch-none place-items-center border-y border-line bg-white outline-none focus:bg-brandblue/[.06]"><span className="absolute inset-x-0 h-px bg-line group-hover:bg-brandblue/30" /><span className="relative grid h-5 w-10 place-items-center rounded-full border border-line bg-white text-slate-400 shadow-sm group-hover:border-brandblue/30 group-hover:text-brandblue"><GripHorizontal size={14} /></span></div>

        <section className="flex min-h-0 flex-1 flex-col">
          <PaneHeader icon={artifact.type === 'latex' ? FileText : Terminal} title={artifact.type === 'latex' ? 'PDF preview' : 'Output'} detail={running ? 'live result' : artifact.type}>{artifact.type === 'latex' && <div className="flex items-center gap-2">{pdfFeedback && <span className="hidden max-w-40 truncate text-[8px] text-muted 2xl:inline">{pdfFeedback}</span>}<button type="button" onClick={exportPdf} className="flex h-7 items-center gap-1.5 rounded-lg bg-brandblue px-2.5 text-[9px] font-semibold text-white transition hover:bg-brandblue/90"><Download size={11} />Export PDF</button></div>}</PaneHeader>
          <div className="min-h-0 flex-1 overflow-hidden"><ResultPreview artifact={workingArtifact} running={running} latexPreviewRef={latexPreviewRef} /></div>
        </section>
      </div> : <div className="grid min-h-0 flex-1 place-items-center bg-canvas/60 p-4 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff4ea] text-brandblue"><FileCode2 size={20} /></span><p className="mt-4 text-xs font-semibold text-ink">Nothing to preview yet</p><p className="mx-auto mt-1 max-w-56 text-[10px] leading-5 text-muted">Choose Preview or Run on an ICU Tutor artifact to inspect its source and output.</p></div></div>}
    </aside>
  </>
}
