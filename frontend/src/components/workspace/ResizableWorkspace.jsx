import { BookOpen, BrainCircuit, Files, Network, Sparkles, Upload, X } from 'lucide-react'
import { cloneElement, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'icu-workspace-layout'
const LEFT_MIN = 240
const LEFT_MAX = 440
const RIGHT_MIN = 280
const RIGHT_MAX = 520
const RAIL_WIDTH = 64
const COLLAPSE_DRAG_DISTANCE = 36
const MIN_CENTER_WIDTH = 280

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min))

function loadLayout() {
  const fallback = { leftWidth: 280, rightWidth: 340, leftCollapsed: false, rightCollapsed: false }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      leftWidth: clamp(stored.leftWidth ?? fallback.leftWidth, LEFT_MIN, LEFT_MAX),
      rightWidth: clamp(stored.rightWidth ?? fallback.rightWidth, RIGHT_MIN, RIGHT_MAX),
      leftCollapsed: Boolean(stored.leftCollapsed),
      rightCollapsed: Boolean(stored.rightCollapsed),
    }
  } catch {
    return fallback
  }
}

function MobileDrawerHeader({ title, onClose }) {
  return <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-white px-4 lg:hidden"><p className="text-xs font-bold text-ink">{title}</p><button onClick={onClose} aria-label="Close panel" className="rounded-xl border border-line p-2 text-muted hover:bg-slate-50 hover:text-ink"><X size={16} /></button></div>
}

function MobileEdgeTabs({ activePane, onOpen }) {
  return <>
    {activePane !== 'documents' && <button type="button" onClick={() => onOpen('documents')} aria-label="Open learning materials" title="Open learning materials" className="absolute left-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-xl border border-l-0 border-line bg-white px-2 py-3 text-brandblue shadow-[5px_8px_22px_rgba(15,23,42,.1)] transition hover:bg-brandblue/[.05] focus-visible:z-[60] lg:hidden"><Files size={16} /><span className="text-[8px] font-bold uppercase tracking-[.12em] [writing-mode:vertical-rl]">Files</span></button>}
    {activePane !== 'tools' && <button type="button" onClick={() => onOpen('tools')} aria-label="Open study tools" title="Open study tools" className="absolute right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-line bg-white px-2 py-3 text-brandblue shadow-[-5px_8px_22px_rgba(18,33,59,.12)] transition hover:border-brandblue/30 hover:bg-brandblue/[.05] focus-visible:z-[60] lg:hidden"><Sparkles size={16} /><span className="text-[8px] font-bold uppercase tracking-[.12em] [writing-mode:vertical-rl]">Tools</span></button>}
  </>
}

function ResizeHandle({ side, value, min, max, collapsed, onPointerDown, onKeyboardResize }) {
  return <div role="separator" aria-orientation="vertical" aria-label={`Resize ${side} panel`} aria-valuemin={collapsed ? RAIL_WIDTH : min} aria-valuemax={max} aria-valuenow={collapsed ? RAIL_WIDTH : value} aria-disabled={collapsed} tabIndex={collapsed ? -1 : 0} onPointerDown={collapsed ? undefined : onPointerDown} onKeyDown={collapsed ? undefined : onKeyboardResize} className={`workspace-resize-handle group relative hidden w-3 touch-none outline-none lg:block ${collapsed ? 'cursor-default' : 'cursor-col-resize'}`}><span className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-brandblue/30 group-focus:bg-brandblue/30" /><span className="absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brandblue/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" /></div>
}

function LeftRail({ onRestore }) {
  const buttons = [
    { icon: BookOpen, section: 'spaces', label: 'Open library' },
    { icon: Files, section: 'documents', label: 'Open documents' },
    { icon: Upload, section: 'upload', label: 'Open upload' },
  ]
  return <aside className="relative hidden h-full w-16 flex-col items-center gap-2 rounded-[18px] border border-line bg-white py-4 shadow-[var(--shadow-sm)] lg:flex"><span className="absolute left-1/2 top-3 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brandblue" />{buttons.map(({ icon: Icon, section, label }, index) => <button key={section} onClick={() => onRestore(section)} title={index === 0 ? 'Open library' : label} aria-label={label} className={`grid h-10 w-10 place-items-center rounded-xl transition ${index === 0 ? 'bg-brandblue/10 text-brandblue' : 'text-slate-400 hover:bg-slate-100 hover:text-ink'}`}><Icon size={17} /></button>)}</aside>
}

function RightRail({ onRestore }) {
  const icons = [Sparkles, BrainCircuit, Network]
  return <aside className="relative hidden h-full w-16 flex-col items-center gap-2 rounded-[18px] border border-line bg-white py-4 shadow-[var(--shadow-sm)] lg:flex"><span className="absolute left-1/2 top-3 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brandblue" />{icons.map((Icon, index) => <button key={index} onClick={onRestore} title="Open study tools" aria-label="Open study tools" className={`grid h-10 w-10 place-items-center rounded-xl transition ${index === 0 ? 'bg-brandblue/10 text-brandblue' : 'text-slate-400 hover:bg-slate-100 hover:text-ink'}`}><Icon size={17} /></button>)}</aside>
}

export default function ResizableWorkspace({ left, center, right, mobilePane, onOpenMobilePane, onCloseMobilePane, leftUnbounded = false, leftRevealKey = null }) {
  const containerRef = useRef(null)
  const [layout, setLayout] = useState(loadLayout)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  useEffect(() => {
    if (!leftRevealKey) return
    setLayout((current) => current.leftCollapsed ? { ...current, leftCollapsed: false } : current)
  }, [leftRevealKey])

  useEffect(() => {
    const constrainToViewport = () => {
      if (window.innerWidth < 1024) return
      setLayout((current) => {
        const containerWidth = containerRef.current?.getBoundingClientRect().width || window.innerWidth
        let leftWidth = leftUnbounded ? current.leftWidth : Math.min(current.leftWidth, LEFT_MAX)
        let rightWidth = Math.min(current.rightWidth, RIGHT_MAX)
        const available = containerWidth - MIN_CENTER_WIDTH - 12
        let occupied = (current.leftCollapsed ? RAIL_WIDTH : leftWidth) + (current.rightCollapsed ? RAIL_WIDTH : rightWidth)

        if (occupied > available && !current.rightCollapsed) {
          const reduction = Math.min(occupied - available, rightWidth - RIGHT_MIN)
          rightWidth -= reduction
          occupied -= reduction
        }
        if (occupied > available && !current.leftCollapsed) {
          leftWidth = Math.max(LEFT_MIN, leftWidth - (occupied - available))
        }

        if (leftWidth === current.leftWidth && rightWidth === current.rightWidth) return current
        return { ...current, leftWidth, rightWidth }
      })
    }

    constrainToViewport()
    window.addEventListener('resize', constrainToViewport)
    return () => window.removeEventListener('resize', constrainToViewport)
  }, [leftUnbounded])

  const collapseLeft = () => setLayout((current) => ({ ...current, leftCollapsed: true }))
  const collapseRight = () => setLayout((current) => ({ ...current, rightCollapsed: true }))
  const restoreLeft = (section = 'spaces') => {
    setLayout((current) => ({ ...current, leftCollapsed: false }))
    window.setTimeout(() => {
      const target = document.getElementById(`workspace-${section}-section`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
    }, 220)
  }
  const restoreRight = () => setLayout((current) => ({ ...current, rightCollapsed: false }))

  const effectiveMax = (side) => {
    const containerWidth = containerRef.current?.getBoundingClientRect().width || window.innerWidth
    const otherWidth = side === 'left'
      ? (layout.rightCollapsed ? RAIL_WIDTH : layout.rightWidth)
      : (layout.leftCollapsed ? RAIL_WIDTH : layout.leftWidth)
    const hardMax = side === 'left' && leftUnbounded ? containerWidth : side === 'left' ? LEFT_MAX : RIGHT_MAX
    const minimum = side === 'left' ? LEFT_MIN : RIGHT_MIN
    return Math.max(minimum, Math.min(hardMax, containerWidth - otherWidth - MIN_CENTER_WIDTH - 12))
  }

  const resizeTo = (side, proposedWidth, collapseEligible = false) => {
    const min = side === 'left' ? LEFT_MIN : RIGHT_MIN
    const max = effectiveMax(side)
    const shouldCollapse = collapseEligible && proposedWidth <= min - COLLAPSE_DRAG_DISTANCE
    setLayout((current) => ({
      ...current,
      [`${side}Collapsed`]: shouldCollapse,
      [`${side}Width`]: shouldCollapse ? current[`${side}Width`] : clamp(proposedWidth, min, max),
    }))
  }

  const startResize = (side, event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = layout[`${side}Width`]
    setResizing(true)

    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      resizeTo(side, side === 'left' ? startWidth + delta : startWidth - delta, true)
    }
    const stop = () => {
      setResizing(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const keyboardResize = (side, event) => {
    const step = event.shiftKey ? 32 : 16
    const currentWidth = layout[`${side}Width`]
    const decreaseKey = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
    const increaseKey = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === decreaseKey) { event.preventDefault(); resizeTo(side, currentWidth - step) }
    if (event.key === increaseKey) { event.preventDefault(); resizeTo(side, currentWidth + step) }
    if (event.key === 'Home') { event.preventDefault(); side === 'left' ? collapseLeft() : collapseRight() }
    if (event.key === 'End') { event.preventDefault(); resizeTo(side, effectiveMax(side)) }
  }

  const leftColumn = layout.leftCollapsed ? RAIL_WIDTH : layout.leftWidth
  const rightColumn = layout.rightCollapsed ? RAIL_WIDTH : layout.rightWidth
  const leftMaximum = effectiveMax('left')
  const rightMaximum = effectiveMax('right')
  const leftPanel = cloneElement(left, { onCollapse: collapseLeft })
  const rightPanel = cloneElement(right, { onCollapse: collapseRight })

  return <div ref={containerRef} style={{ '--left-column': `${leftColumn}px`, '--right-column': `${rightColumn}px` }} className={`workspace-layout relative flex min-h-0 flex-1 overflow-hidden ${resizing ? 'is-resizing' : ''}`}>
    <MobileEdgeTabs activePane={mobilePane} onOpen={onOpenMobilePane} />
    <div className={`workspace-mobile-drawer workspace-mobile-drawer-left absolute inset-0 z-50 flex min-w-0 flex-col overflow-hidden bg-white lg:static lg:z-auto lg:flex ${mobilePane === 'documents' ? 'is-open' : ''}`}><MobileDrawerHeader title="Learning materials" onClose={onCloseMobilePane} /><div className={`min-h-0 flex-1 overflow-hidden ${layout.leftCollapsed ? 'lg:hidden' : ''}`}>{leftPanel}</div>{layout.leftCollapsed && <LeftRail onRestore={restoreLeft} />}</div>
    <ResizeHandle side="left" value={layout.leftWidth} min={LEFT_MIN} max={leftMaximum} collapsed={layout.leftCollapsed} onPointerDown={(event) => startResize('left', event)} onKeyboardResize={(event) => keyboardResize('left', event)} />

    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{center}</div>

    <ResizeHandle side="right" value={layout.rightWidth} min={RIGHT_MIN} max={rightMaximum} collapsed={layout.rightCollapsed} onPointerDown={(event) => startResize('right', event)} onKeyboardResize={(event) => keyboardResize('right', event)} />
    <div className={`workspace-mobile-drawer workspace-mobile-drawer-right absolute inset-0 z-50 flex min-w-0 flex-col bg-white lg:static lg:z-auto lg:flex ${mobilePane === 'tools' ? 'is-open' : ''}`}><MobileDrawerHeader title="Study tools" onClose={onCloseMobilePane} /><div className={`min-h-0 flex-1 ${layout.rightCollapsed ? 'lg:hidden' : ''}`}>{rightPanel}</div>{layout.rightCollapsed && <RightRail onRestore={restoreRight} />}</div>
  </div>
}
