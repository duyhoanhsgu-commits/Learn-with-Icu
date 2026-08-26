import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import Loading from '../common/Loading'
import BrandLogo from '../common/BrandLogo'

export default function MessageList({ messages, isTyping, onSourceClick, variant = 'default' }) {
  const endRef = useRef(null)
  const general = variant === 'general'
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, isTyping])
  return <div className={`mx-auto w-full space-y-5 px-4 py-6 sm:px-6 ${general ? 'max-w-[900px] sm:py-8' : 'max-w-[760px] sm:py-8'}`}>{messages.map((message) => <MessageBubble key={message.id} message={message} onSourceClick={onSourceClick} variant={variant} />)}{isTyping && <div className="flex items-center gap-3"><BrandLogo className="h-9 w-9 rounded-full border border-line bg-white p-1 shadow-sm" /><div className="rounded-[18px] border border-line bg-white px-4 py-3"><Loading /></div></div>}<div ref={endRef} /></div>
}
