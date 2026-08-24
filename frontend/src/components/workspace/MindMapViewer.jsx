import { ArrowLeft, Network } from 'lucide-react'

function MindMapNode({ node, depth = 0 }) {
  const nodeStyle = depth === 0
    ? 'border-navy bg-navy text-white shadow-[0_14px_35px_rgba(11,25,48,.16)]'
    : depth === 1
      ? 'border-teal/35 bg-teal/[.07] text-ink'
      : depth % 2 === 0
        ? 'border-brandblue/25 bg-white text-ink'
        : 'border-violet/25 bg-white text-ink'

  return <div className={depth > 0 ? 'relative border-l border-[#d8e0ec] pl-5 sm:pl-7' : ''}>
    {depth > 0 && <span className="absolute -left-px top-6 h-px w-5 -translate-x-full bg-[#d8e0ec] sm:w-7" />}
    <article className={`rounded-[14px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(18,33,59,.08)] ${nodeStyle} ${depth === 0 ? 'mx-auto max-w-2xl sm:p-5' : ''}`}>
      <h2 className={`font-['Manrope'] text-sm font-bold leading-5 sm:text-[15px] ${depth === 0 ? 'text-white sm:text-base' : 'text-ink'}`}>{node.label}</h2>
      {node.description && <p className={`mt-1.5 text-xs leading-5 ${depth === 0 ? 'text-slate-300' : 'text-muted'}`}>{node.description}</p>}
    </article>
    {node.children?.length > 0 && <div className={`space-y-3 ${depth === 0 ? 'mx-auto mt-5 max-w-[840px]' : 'mt-3'}`}>{node.children.map((child, index) => <MindMapNode key={`${child.label}-${index}`} node={child} depth={depth + 1} />)}</div>}
  </div>
}

export default function MindMapViewer({ mindmap, onExit }) {
  return <section className="tool-page fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-canvas">
    <header className="shrink-0 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[960px] px-4 py-3 sm:px-6 sm:py-4">
        <button onClick={onExit} className="flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold text-muted transition hover:text-teal"><ArrowLeft size={14} />All mind maps</button>
        <div className="mt-2 flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><Network size={17} /></div><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Mind map</p><h1 className="mt-1 truncate font-['Manrope'] text-base font-bold text-ink sm:text-lg">{mindmap.title}</h1></div></div>
      </div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-8"><MindMapNode node={mindmap.root} /></div>
    </main>
  </section>
}
