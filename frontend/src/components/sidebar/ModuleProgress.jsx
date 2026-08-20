import ProgressBar from '../common/ProgressBar'

export default function ModuleProgress({ module }) {
  return <div className="px-3 py-2"><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-xs text-slate-300">{module.name}</span><span className="text-[10px] tabular-nums text-slate-500">{module.progress}/{module.total}</span></div><ProgressBar value={module.progress} max={module.total} /></div>
}
