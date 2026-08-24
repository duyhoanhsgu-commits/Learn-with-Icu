import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import Loading from '../common/Loading'

export default function MessageList({ messages, isTyping }) {
  const endRef = useRef(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, isTyping])
  return <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{isTyping && <div className="flex items-center gap-3"><div className="icu-action-gradient grid h-9 w-9 place-items-center rounded-full text-[9px] font-bold text-white shadow-sm">IC</div><div className="rounded-2xl border border-line bg-white px-4 py-3 shadow-sm"><Loading /></div></div>}<div ref={endRef} /></div>
}
