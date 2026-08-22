import { useRef, useState } from 'react'

export default function ResizableWorkspace({ left, center, right }) {
  const containerRef = useRef(null)
  const [sizes, setSizes] = useState([33.33, 33.34, 33.33])

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
      next[leftIndex] = Math.max(18, startSizes[leftIndex] + delta)
      next[rightIndex] = Math.max(18, startSizes[rightIndex] - delta)
      if (next[leftIndex] === 18 || next[rightIndex] === 18) return
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

  return <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden"><div style={{ flexBasis: `${sizes[0]}%` }} className="min-h-[520px] min-w-0 shrink-0 lg:min-h-0">{left}</div><div onPointerDown={(event) => startResize(0, event)} className="group hidden w-1.5 shrink-0 cursor-col-resize bg-slate-200 transition hover:bg-teal/40 lg:block"><div className="mx-auto h-full w-px bg-slate-300 group-hover:bg-teal" /></div><div style={{ flexBasis: `${sizes[1]}%` }} className="min-h-[520px] min-w-0 shrink-0 lg:min-h-0">{center}</div><div onPointerDown={(event) => startResize(1, event)} className="group hidden w-1.5 shrink-0 cursor-col-resize bg-slate-200 transition hover:bg-teal/40 lg:block"><div className="mx-auto h-full w-px bg-slate-300 group-hover:bg-teal" /></div><div style={{ flexBasis: `${sizes[2]}%` }} className="min-h-[420px] min-w-0 shrink-0 lg:min-h-0">{right}</div></div>
}
