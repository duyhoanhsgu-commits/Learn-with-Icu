export default function RecentSessionItem({ session, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}>
      <p className={`truncate text-[13px] leading-5 ${active ? 'font-medium text-white' : 'text-slate-200'}`}>{session.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500"><span className="text-slate-400">{session.subject}</span> · {session.time}</p>
    </button>
  )
}
