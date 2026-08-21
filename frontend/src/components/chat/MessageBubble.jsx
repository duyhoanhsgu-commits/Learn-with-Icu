import SourceReference from './SourceReference'

export default function MessageBubble({ message }) {
  const user = message.role === 'user'
  const error = message.role === 'error'
  return <div className={`flex gap-3.5 ${user ? 'flex-row-reverse' : ''}`}><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${user ? 'bg-teal text-white' : error ? 'bg-red-100 text-red-700' : 'bg-navy text-white'}`}>{user ? 'MK' : error ? '!' : 'IC'}</div><div className={`max-w-[640px] whitespace-pre-line text-sm leading-7 ${user ? 'rounded-2xl rounded-tr-sm bg-[#e8f5f2] px-4 py-2.5 text-slate-800' : error ? 'rounded-xl bg-red-50 px-4 py-2.5 text-red-700' : 'pt-0.5 text-slate-700'}`}>{message.content}{message.sources?.map((source, index) => <SourceReference key={`${source.fileId}-${source.page}-${index}`} source={source} />)}</div></div>
}
