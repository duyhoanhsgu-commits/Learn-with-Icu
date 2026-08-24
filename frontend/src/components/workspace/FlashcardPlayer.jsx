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

  return <section className="tool-page fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-canvas">
    <header className="shrink-0 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[960px] px-4 py-3 sm:px-6 sm:py-4">
        <button onClick={onExit} className="flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold text-muted transition hover:text-teal"><ArrowLeft size={14} />All flashcards</button>
        <div className="mt-2 flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><LibraryBig size={17} /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Flashcards</p><h1 className="mt-1 truncate font-['Manrope'] text-base font-bold text-ink sm:text-lg">{flashcards.title}</h1><p className="mt-1.5 text-[10px] text-muted sm:text-[11px]">Card {current + 1} of {flashcards.card_count}</p></div></div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${((current + 1) / flashcards.card_count) * 100}%` }} className="h-full rounded-full bg-teal transition-[width] duration-300" /></div>
      </div>
    </header>

    <main className="flex min-h-0 flex-1 items-center overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-5 py-6 sm:px-6 sm:py-10">
        <button onClick={() => setFlipped((value) => !value)} aria-pressed={flipped} aria-label={flipped ? 'Show flashcard question' : 'Reveal flashcard answer'} className="flashcard-scene block h-[min(440px,52vh)] min-h-[320px] w-full rounded-[22px] text-center">
          <span className={`flashcard-inner block h-full w-full ${flipped ? 'is-flipped' : ''}`}>
            <span aria-hidden={flipped} className="flashcard-face absolute inset-0 flex flex-col items-center justify-center rounded-[20px] border border-brandblue/20 bg-white p-7 sm:p-12"><span className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Question</span><span className="mt-6 max-w-xl font-['Manrope'] text-xl font-bold leading-8 text-ink sm:text-2xl sm:leading-9">{card.front}</span><span className="mt-9 flex items-center gap-1.5 text-[10px] text-muted"><RotateCcw size={12} />Click card or press Space to flip</span></span>
            <span aria-hidden={!flipped} className="flashcard-face flashcard-back absolute inset-0 flex flex-col items-center justify-center rounded-[20px] border border-teal/25 bg-white p-7 sm:p-12"><span className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">Answer</span><span className="mt-6 max-w-xl text-base font-medium leading-7 text-ink sm:text-xl sm:leading-8">{card.back}</span><span className="mt-9 flex items-center gap-1.5 text-[10px] text-muted"><RotateCcw size={12} />Click card or press Space to flip</span></span>
          </span>
        </button>
      </div>
    </main>

    <footer className="shrink-0 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[760px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <button disabled={current === 0} onClick={() => move(current - 1)} aria-label="Previous card" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-teal/30 hover:bg-teal/[.04] hover:text-teal disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={18} /></button>
        <button onClick={() => setFlipped((value) => !value)} className="h-11 flex-1 rounded-xl bg-navy px-5 text-xs font-bold text-white shadow-[0_7px_18px_rgba(11,25,48,.16)] transition hover:bg-teal">{flipped ? 'Show question' : 'Reveal answer'}</button>
        <button disabled={current === flashcards.card_count - 1} onClick={() => move(current + 1)} aria-label="Next card" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition hover:border-teal/30 hover:bg-teal/[.04] hover:text-teal disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>
    </footer>
  </section>
}
