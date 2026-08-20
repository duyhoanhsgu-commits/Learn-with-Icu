export default function ProgressBar({ value, max }) {
  const width = `${Math.min(100, (value / max) * 100)}%`
  return <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-teal transition-all" style={{ width }} /></div>
}
