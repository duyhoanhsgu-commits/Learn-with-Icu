import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import SourceReference from './SourceReference'

function normalizeMathDelimiters(content = '') {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `$$${formula}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => `$${formula}$`)
}

export default function MessageBubble({ message }) {
  const user = message.role === 'user'
  const error = message.role === 'error'
  const sources = message.sources || []
  return <div className={`flex gap-3 ${user ? 'flex-row-reverse' : ''}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[9px] font-bold shadow-sm ${user ? 'bg-navy text-white' : error ? 'bg-red-100 text-red-700' : 'icu-action-gradient text-white'}`}>{user ? 'YOU' : error ? '!' : 'IC'}</div><div className={`min-w-0 max-w-[640px] rounded-2xl border text-sm shadow-sm ${user ? 'whitespace-pre-line rounded-tr-md border-brandblue/10 bg-brandblue/[.08] px-4 py-3 leading-7 text-ink' : error ? 'whitespace-pre-line border-red-100 bg-red-50 px-4 py-3 leading-7 text-red-700' : 'border-line bg-white px-4 py-3 text-slate-700'}`}>{user || error ? message.content : <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMathDelimiters(message.content)}</ReactMarkdown></div>}{sources.length > 0 && <div className="message-sources mt-5 border-t border-line pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted">Sources</p><div className="flex flex-wrap gap-2">{sources.map((source, index) => <SourceReference key={`${source.fileId}-${source.page}-${index}`} source={source} />)}</div></div>}</div></div>
}
