import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'

export default function QuizPlayer({ quiz, onExit }) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const question = quiz.questions[current]
  const answered = Object.keys(answers).length
  const score = quiz.questions.reduce((total, item, index) => total + (answers[index] === item.correct_index ? 1 : 0), 0)
  const restart = () => { setCurrent(0); setAnswers({}); setSubmitted(false) }

  return <section className="tool-page fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-canvas">
    <header className="shrink-0 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[960px] px-4 py-3 sm:px-6 sm:py-4">
        <button onClick={onExit} className="flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold text-muted transition hover:text-teal"><ArrowLeft size={14} />All quizzes</button>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Quiz</p><h1 className="mt-1 truncate font-['Manrope'] text-base font-bold text-ink sm:text-lg">{quiz.title}</h1><p className="mt-1.5 text-[10px] text-muted sm:text-[11px]">Question {current + 1} of {quiz.question_count} · {answered} answered</p></div>
          <button onClick={restart} title="Restart quiz" aria-label="Restart quiz" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-teal/30 hover:bg-teal/[.05] hover:text-teal"><RotateCcw size={15} /></button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${((current + 1) / quiz.question_count) * 100}%` }} className="h-full rounded-full bg-teal transition-[width] duration-300" /></div>
      </div>
    </header>

    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
        {submitted && <div className="mb-4 flex items-center justify-between rounded-[18px] border border-brandblue/15 bg-brandblue/[.06] px-5 py-4 text-ink"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-brandblue">Your result</p><p className="mt-1 text-xs text-muted">{Math.round((score / quiz.question_count) * 100)}% correct</p></div><p className="font-['Manrope'] text-3xl font-bold">{score}<span className="text-base text-muted">/{quiz.question_count}</span></p></div>}

        <article className="rounded-[18px] border border-line bg-white p-5 shadow-[var(--shadow-sm)] sm:p-8">
          <p className="font-['Manrope'] text-[18px] font-bold leading-7 text-ink sm:text-[22px] sm:leading-8">{question.question}</p>
          <div className="mt-6 space-y-3">
            {question.options.map((option, optionIndex) => {
              const selected = answers[current] === optionIndex
              const correct = submitted && optionIndex === question.correct_index
              const wrong = submitted && selected && !correct
              const state = correct
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : wrong
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : selected
                    ? 'border-teal bg-teal/[.07] text-ink ring-2 ring-teal/10'
                    : 'border-line bg-white text-slate-600 hover:border-teal/50 hover:bg-teal/[.035] hover:text-ink'
              return <button key={optionIndex} disabled={submitted} onClick={() => setAnswers((items) => ({ ...items, [current]: optionIndex }))} className={`flex w-full items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left text-xs leading-5 transition sm:px-5 sm:py-4 sm:text-sm ${state} disabled:cursor-default`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">{String.fromCharCode(65 + optionIndex)}</span><span className="flex-1">{option}</span>{correct && <CheckCircle2 size={17} className="shrink-0" />}{wrong && <XCircle size={17} className="shrink-0" />}</button>
            })}
          </div>
          {submitted && <div className="mt-5 rounded-[14px] border border-line bg-canvas p-4"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-muted">Explanation</p><p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">{question.explanation}</p></div>}
        </article>
      </div>
    </main>

    <footer className="shrink-0 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[760px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <button disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} aria-label="Previous question" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-teal/30 hover:bg-teal/[.04] hover:text-teal disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={18} /></button>
        {!submitted && current === quiz.question_count - 1 ? <button disabled={answered !== quiz.question_count} onClick={() => setSubmitted(true)} className="icu-primary-action h-11 flex-1 rounded-xl px-5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">Submit quiz</button> : <button disabled={current === quiz.question_count - 1} onClick={() => setCurrent((value) => value + 1)} className="icu-primary-action flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">Next <ChevronRight size={15} /></button>}
      </div>
    </footer>
  </section>
}
