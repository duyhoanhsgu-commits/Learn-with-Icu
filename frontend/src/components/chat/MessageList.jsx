import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import Loading from '../common/Loading'
import BrandLogo from '../common/BrandLogo'

export default function MessageList({ messages, isTyping, onSourceClick }) {
  const endRef = useRef(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, isTyping])
  return <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">{messages.map((message) => <MessageBubble key={message.id} message={message} onSourceClick={onSourceClick} />)}{isTyping && <div className="flex items-center gap-3"><BrandLogo className="h-9 w-9 rounded-full border border-line bg-white p-1 shadow-sm" /><div className="rounded-2xl border border-line bg-white px-4 py-3 shadow-sm"><Loading /></div></div>}<div ref={endRef} /></div>
}
