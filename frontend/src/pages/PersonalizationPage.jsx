import { ArrowLeft, Brain, CheckCircle2, Database, LoaderCircle, Pencil, Plus, Save, ShieldCheck, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import BrandLogo from '../components/common/BrandLogo'
import { spacesApi } from '../api/spaces'

const categories = [
  ['goal', 'Mục tiêu'],
  ['preference', 'Sở thích học'],
  ['technical_decision', 'Quyết định kỹ thuật'],
  ['project', 'Dự án'],
  ['fact', 'Thông tin'],
  ['other', 'Khác'],
]

const emptyForm = { category: 'goal', key: '', value: '', importance: 0.7 }
const categoryLabel = (value) => categories.find(([key]) => key === value)?.[1] || value

export default function PersonalizationPage({ learningSpaces, loadingSpaces, onNavigate }) {
  const [spaceId, setSpaceId] = useState('')
  const [fixedContext, setFixedContext] = useState('')
  const [memories, setMemories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingContext, setSavingContext] = useState(false)
  const [savingMemory, setSavingMemory] = useState(false)
  const [notice, setNotice] = useState(null)

  const activeSpace = useMemo(
    () => learningSpaces.find((space) => space.id === spaceId),
    [learningSpaces, spaceId],
  )

  useEffect(() => {
    if (!spaceId && learningSpaces.length) setSpaceId(learningSpaces[0].id)
  }, [learningSpaces, spaceId])

  useEffect(() => {
    if (!spaceId) return
    let cancelled = false
    setLoading(true)
    setNotice(null)
    setEditingId(null)
    setForm(emptyForm)
    Promise.all([spacesApi.getContext(spaceId), spacesApi.listMemories(spaceId)])
      .then(([context, items]) => {
        if (cancelled) return
        setFixedContext(context.fixed_context || '')
        setMemories(items)
      })
      .catch((error) => !cancelled && setNotice({ type: 'error', message: error.message }))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [spaceId])

  const saveContext = async () => {
    if (!spaceId || savingContext || fixedContext.length > 12000) return
    setSavingContext(true)
    setNotice(null)
    try {
      await spacesApi.updateContext(spaceId, fixedContext)
      setNotice({ type: 'success', message: 'Đã lưu fixed context cho Learning Space này.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setSavingContext(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const saveMemory = async (event) => {
    event.preventDefault()
    const payload = {
      ...form,
      key: form.key.trim(),
      value: form.value.trim(),
      importance: Number(form.importance),
    }
    if (!spaceId || !payload.key || !payload.value || savingMemory) return
    setSavingMemory(true)
    setNotice(null)
    try {
      const saved = editingId
        ? await spacesApi.updateMemory(spaceId, editingId, payload)
        : await spacesApi.createMemory(spaceId, payload)
      setMemories((items) => [saved, ...items.filter((item) => item.id !== saved.id)]
        .sort((a, b) => b.importance - a.importance))
      setNotice({ type: 'success', message: editingId ? 'Đã cập nhật memory.' : 'Đã thêm long-term memory.' })
      resetForm()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setSavingMemory(false)
    }
  }

  const editMemory = (memory) => {
    setEditingId(memory.id)
    setForm({
      category: memory.category,
      key: memory.key,
      value: memory.value,
      importance: memory.importance,
    })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const deleteMemory = async (memory) => {
    if (!window.confirm(`Xóa memory “${memory.key}”?`)) return
    setNotice(null)
    try {
      await spacesApi.deleteMemory(spaceId, memory.id)
      setMemories((items) => items.filter((item) => item.id !== memory.id))
      if (editingId === memory.id) resetForm()
      setNotice({ type: 'success', message: 'Đã xóa memory.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  return <main className="min-h-[100dvh] bg-canvas text-ink">
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><BrandLogo className="h-9 w-9 rounded-xl border border-line bg-white p-0.5 shadow-sm" /><div className="min-w-0"><p className="truncate font-['Manrope'] text-sm font-bold text-ink">ICU Personalization</p><p className="hidden text-[10px] text-muted sm:block">Context and memory controls</p></div></div>
        <button onClick={() => onNavigate('/learn')} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-semibold text-ink transition hover:border-teal/30 hover:bg-teal/[.05] hover:text-teal"><ArrowLeft size={15} />Workspace</button>
      </div>
    </header>

    <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-[24px] bg-navy px-5 py-7 text-white shadow-[0_20px_50px_rgba(11,25,48,.16)] sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-teal/25 via-brandblue/20 to-violet/20 blur-2xl" />
        <div className="relative max-w-2xl"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-teal"><Sparkles size={13} />Cá nhân hóa ICU</p><h1 className="mt-3 font-['Manrope'] text-2xl font-bold tracking-tight sm:text-4xl">Dạy ICU cách đồng hành cùng bạn.</h1><p className="mt-3 text-sm leading-6 text-slate-300 sm:text-[15px]">Fixed Context mô tả bức tranh tổng thể. Long-term Memory lưu các mục tiêu, sở thích và quyết định cụ thể để ICU chọn lại khi câu hỏi liên quan.</p></div>
      </section>

      <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="personal-space" className="text-[10px] font-bold uppercase tracking-[.16em] text-muted">Learning Space</label>
        <select id="personal-space" value={spaceId} onChange={(event) => setSpaceId(event.target.value)} disabled={loadingSpaces || !learningSpaces.length} className="mt-2 w-full rounded-xl border border-line bg-[#F7F8FC] px-3.5 py-3 text-sm font-semibold text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10">
          {!learningSpaces.length && <option value="">Chưa có Learning Space</option>}
          {learningSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
        </select>
      </div>

      {notice && <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${notice.type === 'success' ? 'border-teal/20 bg-teal/[.06] text-[#08786e]' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}<span>{notice.message}</span></div>}

      {loading ? <div className="grid min-h-[360px] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-teal" /><p className="mt-3 text-xs text-muted">Đang tải context và memory…</p></div></div> : activeSpace ? <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <section className="rounded-[20px] border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><UserRound size={19} /></span><div><h2 className="font-['Manrope'] text-lg font-bold">Fixed Context</h2><p className="mt-1 text-xs leading-5 text-muted">Luôn được đưa vào mọi cuộc trò chuyện trong “{activeSpace.name}”.</p></div></div>
          <textarea value={fixedContext} onChange={(event) => setFixedContext(event.target.value)} maxLength={12000} rows={16} placeholder={'Learning goal:\nCurrent project:\nTech stack:\nCurrent progress:\nImportant decisions:'} className="mt-5 w-full resize-y rounded-2xl border border-line bg-[#F7F8FC] px-4 py-3.5 text-sm leading-6 text-ink outline-none transition placeholder:text-slate-400 focus:border-teal focus:bg-white focus:ring-4 focus:ring-teal/10" />
          <div className="mt-3 flex items-center justify-between gap-3"><p className={`text-[10px] ${fixedContext.length > 11400 ? 'text-amber-600' : 'text-muted'}`}>{fixedContext.length.toLocaleString()} / 12,000 ký tự</p><button onClick={saveContext} disabled={savingContext} className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50">{savingContext ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}Lưu context</button></div>
          <div className="mt-5 flex gap-3 rounded-xl border border-brandblue/15 bg-brandblue/[.04] p-3.5"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-brandblue" /><p className="text-[11px] leading-5 text-muted">Context này chỉ là background. Nó không thể ghi đè system hoặc security instructions.</p></div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[20px] border border-line bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet/10 text-violet"><Brain size={19} /></span><div><h2 className="font-['Manrope'] text-lg font-bold">Long-term Memory</h2><p className="mt-1 text-xs leading-5 text-muted">ICU chọn tối đa 8 memory liên quan cho mỗi câu hỏi.</p></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-muted">{memories.length}</span></div>
            <div className="mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {!memories.length && <div className="rounded-2xl border border-dashed border-line bg-[#F7F8FC] px-5 py-8 text-center"><Database className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold">Chưa có memory</p><p className="mt-1 text-[11px] leading-5 text-muted">Thêm mục tiêu hoặc quyết định đầu tiên ở form bên dưới.</p></div>}
              {memories.map((memory) => <article key={memory.id} className="group rounded-2xl border border-line bg-white p-4 transition hover:border-teal/25 hover:shadow-[0_8px_24px_rgba(11,25,48,.07)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full bg-teal/[.07] px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-teal">{categoryLabel(memory.category)}</span><h3 className="mt-2 break-words text-sm font-bold text-ink">{memory.key}</h3></div><div className="flex shrink-0 gap-1"><button onClick={() => editMemory(memory)} aria-label={`Sửa ${memory.key}`} className="rounded-lg p-2 text-muted hover:bg-brandblue/[.07] hover:text-brandblue"><Pencil size={14} /></button><button onClick={() => deleteMemory(memory)} aria-label={`Xóa ${memory.key}`} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></div></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted">{memory.value}</p><div className="mt-3 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal to-brandblue" style={{ width: `${memory.importance * 100}%` }} /></div><span className="text-[9px] font-semibold text-muted">{Math.round(memory.importance * 100)}%</span></div></article>)}
            </div>
          </section>

          <form onSubmit={saveMemory} className="rounded-[20px] border border-line bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal">{editingId ? 'Chỉnh sửa' : 'Memory mới'}</p><h2 className="mt-1 font-['Manrope'] text-base font-bold">{editingId ? 'Cập nhật điều ICU cần nhớ' : 'Thêm điều ICU cần nhớ'}</h2></div>{editingId && <button type="button" onClick={resetForm} className="rounded-lg p-2 text-muted hover:bg-slate-100" aria-label="Hủy chỉnh sửa"><X size={16} /></button>}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Loại<select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-line bg-[#F7F8FC] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-ink outline-none focus:border-teal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">Tên memory<input value={form.key} onChange={(event) => setForm((value) => ({ ...value, key: event.target.value }))} maxLength={120} placeholder="vector_database" className="mt-1.5 w-full rounded-xl border border-line bg-[#F7F8FC] px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-ink outline-none focus:border-teal" /></label></div>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[.12em] text-muted">Nội dung<textarea value={form.value} onChange={(event) => setForm((value) => ({ ...value, value: event.target.value }))} maxLength={2000} rows={4} placeholder="Use Qdrant for vector retrieval" className="mt-1.5 w-full resize-y rounded-xl border border-line bg-[#F7F8FC] px-3 py-2.5 text-xs font-medium leading-5 normal-case tracking-normal text-ink outline-none focus:border-teal" /></label>
            <label className="mt-3 block text-[10px] font-bold uppercase tracking-[.12em] text-muted">Độ quan trọng · {Math.round(form.importance * 100)}%<input type="range" min="0" max="1" step="0.1" value={form.importance} onChange={(event) => setForm((value) => ({ ...value, importance: Number(event.target.value) }))} className="mt-2 w-full accent-[#12B8AA]" /></label>
            <button type="submit" disabled={savingMemory || !form.key.trim() || !form.value.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40">{savingMemory ? <LoaderCircle size={15} className="animate-spin" /> : editingId ? <Save size={15} /> : <Plus size={15} />}{editingId ? 'Lưu thay đổi' : 'Thêm memory'}</button>
          </form>
        </div>
      </div> : <div className="mt-6 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center"><UserRound className="mx-auto text-slate-300" /><h2 className="mt-4 font-['Manrope'] text-lg font-bold">Chưa có Learning Space</h2><p className="mt-2 text-xs text-muted">Tạo một space trong Learning Workspace trước khi cá nhân hóa.</p><button onClick={() => onNavigate('/learn')} className="mt-5 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal">Mở Workspace</button></div>}
    </div>
  </main>
}
