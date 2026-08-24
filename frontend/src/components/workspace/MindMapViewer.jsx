import { ArrowLeft, Network } from 'lucide-react'

const branchColors = [
  'border-teal/30 bg-teal/[.06]',
  'border-blue-300 bg-blue-50/70',
  'border-violet-300 bg-violet-50/70',
  'border-amber-300 bg-amber-50/70',
]

function MindMapNode({ node, depth = 0, branchIndex = 0 }) {
  const color = depth === 0 ? 'border-navy bg-navy text-white' : branchColors[branchIndex % branchColors.length]
  return <div className={depth > 0 ? 'relative border-l border-slate-200 pl-4' : ''}>
    {depth > 0 && <span className="absolute -left-px top-5 h-px w-4 -translate-x-full bg-slate-200" />}
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className={`text-xs font-bold leading-5 ${depth === 0 ? 'text-white' : 'text-slate-750'}`}>{node.label}</p>
      {node.description && <p className={`mt-1 text-[10px] leading-4 ${depth === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{node.description}</p>}
    </div>
    {node.children?.length > 0 && <div className={`space-y-3 ${depth === 0 ? 'mt-4' : 'mt-3'}`}>
      {node.children.map((child, index) => <MindMapNode key={`${child.label}-${index}`} node={child} depth={depth + 1} branchIndex={depth === 0 ? index : branchIndex} />)}
    </div>}
  </div>
}

export default function MindMapViewer({ mindmap, onExit }) {
  return <section className="flex h-full flex-col bg-[#f7f8f6]">
    <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4">
      <button onClick={onExit} className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal"><ArrowLeft size={14} />All mind maps</button>
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal/10 text-teal"><Network size={17} /></div><div className="min-w-0"><p className="text-[10px] font-bold tracking-[.16em] text-teal">MIND MAP</p><h2 className="mt-0.5 truncate font-['Manrope'] text-sm font-bold">{mindmap.title}</h2></div></div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4"><MindMapNode node={mindmap.root} /></div>
  </section>
}
