import { ArrowLeft, Maximize2, Minus, Network, Plus } from 'lucide-react'
import { useState } from 'react'

function ChildNode({ node, depth = 0 }) {
  return <div className="mindmap-child" style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}>
    <article className="mindmap-child-card">
      <h3>{node.label}</h3>
      {node.description && <p>{node.description}</p>}
    </article>
    {node.children?.length > 0 && <div className="mindmap-child-list">{node.children.map((child, index) => <ChildNode key={`${child.label}-${index}`} node={child} depth={depth + 1} />)}</div>}
  </div>
}

function BranchNode({ node }) {
  return <section className="mindmap-branch">
    <article className="mindmap-branch-card">
      <h2>{node.label}</h2>
      {node.description && <p>{node.description}</p>}
    </article>
    {node.children?.length > 0 && <div className="mindmap-child-list">{node.children.map((child, index) => <ChildNode key={`${child.label}-${index}`} node={child} />)}</div>}
  </section>
}

export default function MindMapViewer({ mindmap, onExit }) {
  const [zoom, setZoom] = useState(1)
  const changeZoom = (amount) => setZoom((value) => Math.min(1.4, Math.max(0.7, Number((value + amount).toFixed(1)))))

  return <section className="tool-page fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-canvas">
    <header className="shrink-0 border-b border-line bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-3 sm:px-6 sm:py-4">
        <button onClick={onExit} className="flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold text-muted transition hover:text-brandblue"><ArrowLeft size={14} />All mind maps</button>
        <div className="mt-2 flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brandblue/10 text-brandblue"><Network size={17} /></div><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-brandblue">Mind map</p><h1 className="mt-1 truncate text-base font-semibold text-ink sm:text-lg">{mindmap.title}</h1></div></div>
      </div>
    </header>

    <main className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-7">
      <div className="mindmap-stage" style={{ transform: `scale(${zoom})` }}>
        <article className="mindmap-root">
          <h2>{mindmap.root.label}</h2>
          {mindmap.root.description && <p>{mindmap.root.description}</p>}
        </article>
        {mindmap.root.children?.length > 0 && <div className="mindmap-branches">{mindmap.root.children.map((branch, index) => <BranchNode key={`${branch.label}-${index}`} node={branch} />)}</div>}
      </div>

      <div className="sticky bottom-3 left-3 mt-5 flex w-fit items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-sm)]">
        <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-brandblue/[.06] hover:text-brandblue"><Minus size={14} /></button>
        <span className="w-11 text-center text-[10px] font-semibold text-ink">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-brandblue/[.06] hover:text-brandblue"><Plus size={14} /></button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Fit to screen" title="Fit to screen" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-brandblue/[.06] hover:text-brandblue"><Maximize2 size={14} /></button>
      </div>
    </main>
  </section>
}
