import { ArrowLeft, ChevronLeft, ChevronRight, LibraryBig, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function FlashcardPlayer({ flashcards, onExit }) {
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = flashcards.cards[current]

  const move = (next) => {
    setCurrent(next)
    setFlipped(false)
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setFlipped((value) => !value)
      }
      if (event.key === 'ArrowLeft' && current > 0) move(current - 1)
      if (event.key === 'ArrowRight' && current < flashcards.card_count - 1) move(current + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, flashcards.card_count])

  return <section className="flex h-full flex-col bg-[#f7f8f6]">
    <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4">
      <button onClick={onExit} className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal"><ArrowLeft size={14} />All flashcards</button>
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal/10 text-teal"><LibraryBig size={17} /></div><div className="min-w-0"><p className="text-[10px] font-bold tracking-[.16em] text-teal">FLASHCARDS</p><h2 className="mt-0.5 truncate font-['Manrope'] text-sm font-bold">{flashcards.title}</h2></div></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${((current + 1) / flashcards.card_count) * 100}%` }} className="h-full rounded-full bg-teal transition-all" /></div>
      <p className="mt-2 text-[10px] text-slate-400">Card {current + 1} of {flashcards.card_count}</p>
    </header>

    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto p-4">
      <button onClick={() => setFlipped((value) => !value)} className={`flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border p-7 text-center shadow-sm transition ${flipped ? 'border-teal/30 bg-teal/[.06]' : 'border-slate-200 bg-white hover:border-teal/40'}`}>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal">{flipped ? 'Answer' : 'Question'}</p>
        <p className={`mt-5 leading-7 text-slate-800 ${flipped ? 'text-sm' : "font-['Manrope'] text-base font-bold"}`}>{flipped ? card.back : card.front}</p>
        <p className="mt-7 flex items-center gap-1.5 text-[10px] text-slate-400"><RotateCcw size={11} />Click card or press Space to flip</p>
      </button>
    </div>

    <footer className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-4">
      <button disabled={current === 0} onClick={() => move(current - 1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30"><ChevronLeft size={17} /></button>
      <button onClick={() => setFlipped((value) => !value)} className="h-10 flex-1 rounded-xl bg-navy px-4 text-xs font-semibold text-white hover:bg-teal">{flipped ? 'Show question' : 'Reveal answer'}</button>
      <button disabled={current === flashcards.card_count - 1} onClick={() => move(current + 1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30"><ChevronRight size={17} /></button>
    </footer>
  </section>
}
