import { ChevronDown, FlaskConical } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ResearchProgressStep from './ResearchProgressStep'

const stageLabels = {
  understand: 'Understanding the question',
  plan: 'Planning the research',
  rewrite: 'Preparing search queries',
  retrieve_local: 'Searching uploaded documents',
  search: 'Searching web sources',
  read: 'Reading candidate sources',
  rerank: 'Ranking local evidence',
  rank_sources: 'Ranking research sources',
  extract: 'Extracting key evidence',
  critic: 'Checking the evidence',
  evaluate: 'Checking evidence coverage',
  synthesize: 'Writing the answer',
  citation_check: 'Checking citations',
}

function stageKey(stage = '') {
  return String(stage).replace(/^research\./, '') || 'processing'
}

function progressDetail(event, key) {
  const current = Number.isInteger(event.current) ? event.current : null
  const total = Number.isInteger(event.total) ? event.total : null
  if (key === 'search' && total !== null) return `${total} search ${total === 1 ? 'query' : 'queries'}${current !== null ? ` · pass ${current}` : ''}`
  if (key === 'retrieve_local' && total !== null) return `${total} research ${total === 1 ? 'question' : 'questions'}`
  if (key === 'read' && total !== null) return `${total} candidate ${total === 1 ? 'source' : 'sources'}`
  if (key === 'rerank' && current !== null) return `${current} local ${current === 1 ? 'result' : 'results'}`
  if (current !== null && total !== null) return `${current} of ${total}`
  return null
}

function buildSteps(events, status) {
  const visible = []
  const indexes = new Map()
  for (const event of events) {
    const key = stageKey(event.stage)
    if (key === 'done') continue
    const step = {
      stage: key,
      label: stageLabels[key] || 'Processing research',
      detail: progressDetail(event, key),
      explicitStatus: event.status,
    }
    if (indexes.has(key)) visible[indexes.get(key)] = step
    else {
      indexes.set(key, visible.length)
      visible.push(step)
    }
  }
  return visible.map((step, index) => {
    let stepStatus = status === 'completed' ? 'completed' : index === visible.length - 1 ? 'active' : 'completed'
    if (step.explicitStatus) stepStatus = step.explicitStatus
    if (status === 'failed' && index === visible.length - 1) stepStatus = 'failed'
    return { ...step, status: stepStatus }
  })
}

export default function ResearchProgress({ events = [], status = 'running', sourceCount = 0 }) {
  const completed = status === 'completed'
  const failed = status === 'failed'
  const [expanded, setExpanded] = useState(!completed)
  const steps = useMemo(() => buildSteps(events, status), [events, status])

  useEffect(() => {
    if (!completed) {
      setExpanded(true)
      return undefined
    }
    const timeout = window.setTimeout(() => setExpanded(false), 650)
    return () => window.clearTimeout(timeout)
  }, [completed])

  if (!steps.length && !completed && !failed) return null
  const title = failed ? 'Research interrupted' : completed ? 'Researched for this answer' : 'Researching'
  const collapsedSummary = `${failed ? 'Research interrupted' : 'Research completed'}${sourceCount ? ` · ${sourceCount} sources` : ''}`

  return <section className={`research-progress ${expanded ? 'is-expanded' : 'is-collapsed'} ${failed ? 'has-failed' : ''}`} aria-live="polite">
    <button type="button" className="research-progress-header" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <span className="research-progress-heading-icon" aria-hidden="true"><FlaskConical size={14} /></span>
      <span className="min-w-0 flex-1 truncate text-left font-semibold text-slate-700">{expanded ? title : collapsedSummary}</span>
      {!completed && !failed && <span className="research-progress-live"><span aria-hidden="true" />Live</span>}
      <ChevronDown size={14} className="research-progress-chevron" aria-hidden="true" />
    </button>
    {expanded && <ol className="research-progress-steps">
      {steps.map((step) => <ResearchProgressStep key={step.stage} step={step} />)}
    </ol>}
  </section>
}
