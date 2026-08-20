import { Plus } from 'lucide-react'
import Button from '../common/Button'

export default function NewSessionButton({ onClick }) {
  return <Button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b8d81]"><Plus size={17} strokeWidth={2.5} /> New session</Button>
}
