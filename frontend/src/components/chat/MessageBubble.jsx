import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Check, ChevronDown, Copy, Eye, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import SourceReference from './SourceReference'
import ResearchProgress from './ResearchProgress'
import BrandLogo from '../common/BrandLogo'
import { extractArtifacts, isRunnableArtifact } from '../../utils/artifacts'

function normalizeMathDelimiters(content = '') {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `$$${formula}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${formula}$`)
}

function linkifyPlainCitations(content = '', sourceCount = 0) {
  const linkedDoubleBrackets = content.replace(/\[\[(\d+)\]\]/g, (match, value) => {
    const number = Number(value)
    return number >= 1 && number <= sourceCount ? `[${number}](#source-${number})` : match
  })
  return linkedDoubleBrackets.replace(/(?<!\[)\[((?:\d+\s*,\s*)*\d+)\](?!\s*\()/g, (match, values) => {
    const numbers = values.split(',').map((value) => Number(value.trim()))
    if (numbers.some((number) => number < 1 || number > sourceCount)) return match
    return numbers.map((number) => `[${number}](#source-${number})`).join('')
  })
}

function renumberCitationLinks(content = '') {
  const displayNumbers = new Map()
  return content.replace(/\(#source-(\d+)\)/g, (match, value) => {
    const sourceNumber = Number(value)
    if (!displayNumbers.has(sourceNumber)) displayNumbers.set(sourceNumber, displayNumbers.size + 1)
    return `(#source-ref-${displayNumbers.get(sourceNumber)}-${sourceNumber})`
  })
}

function ArtifactCodeBlock({ className = '', children, messageId, onPreviewArtifact }) {
  const [copied, setCopied] = useState(false)
  const rawWithNewline = String(children)
  const language = className.match(/language-([^\s]+)/)?.[1] || ''
  const block = Boolean(language) || rawWithNewline.includes('\n')
  if (!block) return <code className={className}>{children}</code>

  const raw = rawWithNewline.replace(/\n$/, '')
  const artifact = extractArtifacts(`\`\`\`${language}\n${raw}\n\`\`\``, `${messageId}-inline`)[0]
  const runnable = isRunnableArtifact(artifact)
  const copy = async () => {
    await navigator.clipboard.writeText(raw)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return <div className="assistant-code-artifact">
    <div className="assistant-code-toolbar"><span>{language || 'code'}</span><div className="flex items-center gap-1"><button type="button" onClick={copy}>{copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}</button>{artifact && onPreviewArtifact && <button type="button" onClick={() => onPreviewArtifact({ ...artifact, mode: runnable ? 'run' : 'preview' })}>{runnable ? <Play size={11} /> : <Eye size={11} />}{runnable ? 'Run' : 'Preview'}</button>}</div></div>
    <pre><code className={className}>{raw}</code></pre>
  </div>
}

export default function MessageBubble({ message, onSourceClick, onPreviewArtifact, variant = 'default' }) {
  const user = message.role === 'user'
  const error = message.role === 'error'
  const general = variant === 'general'
  const sources = message.sources || []
  const researchEvents = message.researchProgress || []
  const artifacts = useMemo(() => user || error ? [] : extractArtifacts(message.content, message.id), [error, message.content, message.id, user])
  const standaloneArtifacts = artifacts.filter((artifact) => artifact.id.includes('-artifact-latex-'))
  const [copied, setCopied] = useState(false)
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false)
  const markdown = renumberCitationLinks(linkifyPlainCitations(normalizeMathDelimiters(message.content), sources.length))
  const markdownComponents = {
    pre: ({ children }) => children,
    code: ({ className, children }) => <ArtifactCodeBlock className={className} messageId={message.id} onPreviewArtifact={onPreviewArtifact}>{children}</ArtifactCodeBlock>,
    a: ({ href, children, ...props }) => {
      const match = href?.match(/^#source-ref-(\d+)-(\d+)$/)
      if (match) {
        const displayNumber = Number(match[1])
        const sourceNumber = Number(match[2])
        const source = sources[sourceNumber - 1]
        return source ? <SourceReference source={source} number={displayNumber} onSelect={onSourceClick} /> : children
      }
      return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
    },
  }
  const copyResponse = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  const preview = (artifact) => {
    setPreviewMenuOpen(false)
    onPreviewArtifact?.(artifact)
  }

  return <div className={`flex gap-3 ${user ? 'flex-row-reverse' : ''}`}>
    {user || error ? <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[9px] font-bold shadow-sm ${user ? 'bg-[#172033] text-white' : 'bg-red-100 text-red-700'}`}>{user ? 'YOU' : '!'}</div> : <BrandLogo className="h-9 w-9 rounded-full border border-line bg-white p-1 shadow-sm" />}
    <div className={`min-w-0 rounded-[18px] border text-sm ${general && !user ? 'max-w-[850px] px-6 py-5 sm:px-7 sm:py-6' : 'max-w-[640px] px-4 py-3'} ${user ? 'whitespace-pre-line rounded-tr-md border-brandblue/10 bg-brandblue/[.08] leading-7 text-ink' : error ? 'whitespace-pre-line border-red-100 bg-red-50 leading-7 text-red-700' : 'border-line bg-white text-slate-700'}`}>
      {user || error ? message.content : <>{researchEvents.length > 0 && <ResearchProgress events={researchEvents} status={message.researchStatus} sourceCount={sources.length} />}{message.content && <div className={researchEvents.length ? 'assistant-markdown mt-4' : 'assistant-markdown'}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>{markdown}</ReactMarkdown></div>}{standaloneArtifacts.length > 0 && <div className="mt-3 flex items-center justify-end gap-1 border-t border-line/70 pt-2.5"><button type="button" onClick={copyResponse} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[9px] font-semibold text-muted transition hover:bg-slate-100 hover:text-ink">{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>{onPreviewArtifact && <div className="relative">{standaloneArtifacts.length === 1 ? <button type="button" onClick={() => preview(standaloneArtifacts[0])} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[9px] font-semibold text-brandblue transition hover:bg-brandblue/[.07]"><Eye size={12} />Preview</button> : <><button type="button" onClick={() => setPreviewMenuOpen((open) => !open)} aria-expanded={previewMenuOpen} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[9px] font-semibold text-brandblue transition hover:bg-brandblue/[.07]"><Eye size={12} />Preview {standaloneArtifacts.length}<ChevronDown size={11} /></button>{previewMenuOpen && <div className="absolute bottom-full right-0 z-30 mb-1.5 w-48 rounded-xl border border-line bg-white p-1.5 shadow-[0_10px_28px_rgba(15,23,42,.12)]">{standaloneArtifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => preview(artifact)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-slate-700 hover:bg-brandblue/[.06] hover:text-brandblue"><span className="truncate">{artifact.title}</span><span className="shrink-0 text-[8px] uppercase text-muted">{artifact.type}</span></button>)}</div>}</>}</div>}</div>}</>}
    </div>
  </div>
}
