import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, isTyping }) {
  const endRef = useRef(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, isTyping])
  return <div className="mx-auto w-full max-w-[770px] space-y-8 px-5 py-10 sm:px-7 sm:py-14">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{isTyping && <div className="flex items-center gap-3.5"><div className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-[10px] font-bold text-white">IC</div><div className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></div></div>}<div ref={endRef} /></div>
}
