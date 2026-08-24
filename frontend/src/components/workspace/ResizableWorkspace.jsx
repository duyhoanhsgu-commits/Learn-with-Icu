import { X } from 'lucide-react'
import { useRef, useState } from 'react'

function MobileDrawerHeader({ title, onClose }) {
  return <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-white px-4 xl:hidden"><p className="text-xs font-bold text-ink">{title}</p><button onClick={onClose} aria-label="Close panel" className="rounded-xl border border-line p-2 text-muted hover:bg-slate-50 hover:text-ink"><X size={16} /></button></div>
}

export default function ResizableWorkspace({ left, center, right, mobilePane, onCloseMobilePane }) {
  const containerRef = useRef(null)
  const [sizes, setSizes] = useState([26, 45, 29])

  const startResize = (dividerIndex, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startSizes = [...sizes]
    const width = containerRef.current?.getBoundingClientRect().width || 1

    const move = (moveEvent) => {
      const delta = ((moveEvent.clientX - startX) / width) * 100
      const next = [...startSizes]
      const leftIndex = dividerIndex
      const rightIndex = dividerIndex + 1
      next[leftIndex] = Math.max(20, startSizes[leftIndex] + delta)
      next[rightIndex] = Math.max(20, startSizes[rightIndex] - delta)
      if (next[leftIndex] === 20 || next[rightIndex] === 20) return
      setSizes(next)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
    <div style={{ flexBasis: `${sizes[0]}%` }} className={`${mobilePane === 'documents' ? 'absolute inset-0 z-50 flex' : 'hidden'} min-w-0 flex-col bg-white xl:static xl:z-auto xl:flex xl:shrink-0`}><MobileDrawerHeader title="Learning materials" onClose={onCloseMobilePane} /><div className="min-h-0 flex-1">{left}</div></div>
    <div onPointerDown={(event) => startResize(0, event)} className="group relative hidden w-2 shrink-0 cursor-col-resize bg-line/70 transition hover:bg-teal/15 xl:block"><div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line group-hover:bg-teal" /></div>

    <div style={{ flexBasis: `${sizes[1]}%` }} className="min-w-0 flex-1 xl:shrink-0">{center}</div>

    <div onPointerDown={(event) => startResize(1, event)} className="group relative hidden w-2 shrink-0 cursor-col-resize bg-line/70 transition hover:bg-teal/15 xl:block"><div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line group-hover:bg-teal" /></div>
    <div style={{ flexBasis: `${sizes[2]}%` }} className={`${mobilePane === 'tools' ? 'absolute inset-0 z-50 flex' : 'hidden'} min-w-0 flex-col bg-white xl:static xl:z-auto xl:flex xl:shrink-0`}><MobileDrawerHeader title="Study tools" onClose={onCloseMobilePane} /><div className="min-h-0 flex-1">{right}</div></div>
  </div>
}
