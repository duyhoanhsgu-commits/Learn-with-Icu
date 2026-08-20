import RecentSessionItem from './RecentSessionItem'

export default function RecentSessions({ sessions, activeId, onSelect }) {
  return <section className="mt-7"><h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">RECENT</h2><div className="space-y-0.5">{sessions.map((session) => <RecentSessionItem key={session.id} session={session} active={session.id === activeId} onClick={() => onSelect(session.id)} />)}</div></section>
}
