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
  return <div className={`flex gap-3.5 ${user ? 'flex-row-reverse' : ''}`}><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${user ? 'bg-teal text-white' : error ? 'bg-red-100 text-red-700' : 'bg-navy text-white'}`}>{user ? 'MK' : error ? '!' : 'IC'}</div><div className={`min-w-0 max-w-[640px] text-sm ${user ? 'whitespace-pre-line rounded-2xl rounded-tr-sm bg-[#e8f5f2] px-4 py-2.5 leading-7 text-slate-800' : error ? 'whitespace-pre-line rounded-xl bg-red-50 px-4 py-2.5 leading-7 text-red-700' : 'pt-0.5 text-slate-700'}`}>{user || error ? message.content : <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMathDelimiters(message.content)}</ReactMarkdown></div>}{sources.length > 0 && <div className="message-sources mt-5 border-t border-slate-200 pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Sources</p><div className="flex flex-wrap gap-2">{sources.map((source, index) => <SourceReference key={`${source.fileId}-${source.page}-${index}`} source={source} />)}</div></div>}</div></div>
}
