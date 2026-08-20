import ModuleProgress from './ModuleProgress'

export default function ModuleList({ modules }) {
  return <section className="mt-7"><h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">MODULES</h2><div className="space-y-1">{modules.map((module) => <ModuleProgress key={module.name} module={module} />)}</div></section>
}
