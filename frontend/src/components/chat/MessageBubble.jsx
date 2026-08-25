import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import SourceReference from './SourceReference'
import BrandLogo from '../common/BrandLogo'

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

export default function MessageBubble({ message, onSourceClick }) {
  const user = message.role === 'user'
  const error = message.role === 'error'
  const sources = message.sources || []
  const markdown = renumberCitationLinks(linkifyPlainCitations(normalizeMathDelimiters(message.content), sources.length))
  const markdownComponents = {
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
  return <div className={`flex gap-3 ${user ? 'flex-row-reverse' : ''}`}>{user || error ? <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[9px] font-bold shadow-sm ${user ? 'bg-navy text-white' : 'bg-red-100 text-red-700'}`}>{user ? 'YOU' : '!'}</div> : <BrandLogo className="h-9 w-9 rounded-full border border-line bg-white p-1 shadow-sm" />}<div className={`min-w-0 max-w-[640px] rounded-2xl border text-sm shadow-sm ${user ? 'whitespace-pre-line rounded-tr-md border-brandblue/10 bg-brandblue/[.08] px-4 py-3 leading-7 text-ink' : error ? 'whitespace-pre-line border-red-100 bg-red-50 px-4 py-3 leading-7 text-red-700' : 'border-line bg-white px-4 py-3 text-slate-700'}`}>{user || error ? message.content : <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>{markdown}</ReactMarkdown></div>}</div></div>
}
