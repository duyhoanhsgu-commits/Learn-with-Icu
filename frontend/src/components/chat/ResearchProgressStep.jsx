import { Check, Circle, LoaderCircle, X } from 'lucide-react'

const statusIcon = {
  pending: Circle,
  active: LoaderCircle,
  completed: Check,
  failed: X,
}

export default function ResearchProgressStep({ step }) {
  const Icon = statusIcon[step.status] || Circle
  return <li className={`research-progress-step is-${step.status}`}>
    <span className="research-progress-step-icon" aria-hidden="true"><Icon size={12} /></span>
    <span className="min-w-0 flex-1">
      <span className="block font-medium text-slate-700">{step.label}</span>
      {step.detail && <span className="mt-0.5 block text-[10px] leading-4 text-muted">{step.detail}</span>}
    </span>
    <span className="sr-only">{step.status}</span>
  </li>
}
