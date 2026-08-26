import {
  ArrowLeft, BookOpen, Brain, Check, CheckCircle2, ChevronRight, Clock3, Database, Globe2,
  GraduationCap, History, LoaderCircle, MessageCircle, Pencil, Plus, Save,
  ShieldCheck, Sparkles, Target, Trash2, UserRound, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import BrandLogo from '../components/common/BrandLogo'
import { profileApi } from '../api/profile'
import { spacesApi } from '../api/spaces'

const profileFields = [
  { section: 'personal', key: 'preferred_name', label: 'Preferred name', category: 'fact', placeholder: 'Hoang' },
  { section: 'personal', key: 'current_role', label: 'Current role', category: 'fact', placeholder: 'AI Engineer' },
  { section: 'personal', key: 'experience_level', label: 'Experience level', category: 'fact', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
  { section: 'personal', key: 'main_domain', label: 'Main field / domain', category: 'fact', placeholder: 'RAG, AI Engineering' },
  { section: 'personal', key: 'current_project', label: 'Current project', category: 'project', placeholder: 'Learn-with-ICU' },
  { section: 'personal', key: 'language_preference', label: 'Language preference', category: 'preference', type: 'select', options: ['Vietnamese', 'English', 'Vietnamese with English technical terms'] },
  { section: 'learning', key: 'learning_style', label: 'How do you learn best?', category: 'preference', type: 'textarea', placeholder: 'Step-by-step explanations with real-world examples and small projects.' },
  { section: 'learning', key: 'technical_depth', label: 'Preferred technical depth', category: 'preference', type: 'select', options: ['Simple', 'Balanced', 'Advanced'] },
  { section: 'goals', key: 'learning_goal', label: 'Current learning goal', category: 'goal', type: 'textarea', placeholder: 'Master RAG and build production AI systems.' },
  { section: 'goals', key: 'topics_of_interest', label: 'Topics you care about', category: 'goal', placeholder: 'RAG, AI Agents, Embeddings, Vector DB' },
  { section: 'goals', key: 'long_term_goal', label: 'Long-term goal', category: 'goal', placeholder: 'Become an AI Engineer.' },
  { section: 'response', key: 'response_style', label: 'How should ICU respond?', category: 'preference', type: 'textarea', placeholder: 'Lead with the main point, explain clearly, and give practical examples.' },
  { section: 'response', key: 'response_length', label: 'Preferred response length', category: 'preference', type: 'select', options: ['Concise', 'Balanced', 'Detailed'] },
  { section: 'response', key: 'custom_preference', label: 'Anything else ICU should know?', category: 'preference', type: 'textarea', placeholder: 'When teaching code, explain why each step exists.' },
]

const sections = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'personal', label: 'Personal Information', icon: UserRound },
  { id: 'learning', label: 'Learning Style', icon: GraduationCap },
  { id: 'goals', label: 'Interests & Goals', icon: Target },
  { id: 'response', label: 'Response Preferences', icon: MessageCircle },
  { id: 'memory', label: 'Long-term Memory', icon: Brain },
  { id: 'workspace', label: 'Workspace Context', icon: BookOpen },
  { id: 'history', label: 'Change History', icon: History },
]

const sectionInfo = {
  personal: { title: 'Personal Information', description: 'Help ICU understand who you are and what you are working on.', icon: UserRound },
  learning: { title: 'Learning Style', description: 'Choose the level and explanation style that helps you learn best.', icon: GraduationCap },
  goals: { title: 'Interests & Goals', description: 'Keep recommendations aligned with what you want to achieve.', icon: Target },
  response: { title: 'Response Preferences', description: 'Describe how ICU should communicate with you.', icon: MessageCircle },
}

const keyLabels = Object.fromEntries(profileFields.map((field) => [field.key, field.label]))
const emptyMemory = { category: 'other', key: '', value: '', importance: 0.7 }

function humanDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Field({ field, value, onChange }) {
  const shared = 'mt-2 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brandblue/45 focus:bg-white focus:ring-4 focus:ring-brandblue/[.07]'
  return <label className={`${field.type === 'textarea' ? 'personalization-field-wide' : ''} text-[11px] font-semibold text-slate-700`}>
    {field.label}
    {field.type === 'select'
      ? <select value={value} onChange={(event) => onChange(event.target.value)} className={shared}><option value="">Select an option</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
      : field.type === 'textarea'
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} maxLength={2000} placeholder={field.placeholder} className={`${shared} resize-y leading-6`} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={2000} placeholder={field.placeholder} className={shared} />}
  </label>
}

export default function PersonalizationPage({ learningSpaces, loadingSpaces, onNavigate }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [memories, setMemories] = useState([])
  const [profile, setProfile] = useState({})
  const [spaceId, setSpaceId] = useState('')
  const [fixedContext, setFixedContext] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingContext, setLoadingContext] = useState(false)
  const [savingSection, setSavingSection] = useState('')
  const [savingContext, setSavingContext] = useState(false)
  const [memoryForm, setMemoryForm] = useState(emptyMemory)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const activeSpace = learningSpaces.find((space) => space.id === spaceId)

  const applyMemories = (items) => {
    setMemories(items)
    const values = {}
    profileFields.forEach((field) => { values[field.key] = items.find((item) => item.key === field.key)?.value || '' })
    setProfile(values)
  }

  const loadMemories = async () => {
    const items = await profileApi.listMemories()
    applyMemories(items)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    profileApi.listMemories()
      .then((items) => { if (!cancelled) applyMemories(items) })
      .catch((error) => { if (!cancelled) setNotice({ type: 'error', message: error.message }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!spaceId && learningSpaces.length) setSpaceId(learningSpaces[0].id)
  }, [learningSpaces, spaceId])

  useEffect(() => {
    if (!spaceId) { setFixedContext(''); return }
    let cancelled = false
    setLoadingContext(true)
    spacesApi.getContext(spaceId)
      .then((context) => { if (!cancelled) setFixedContext(context.fixed_context || '') })
      .catch((error) => { if (!cancelled) setNotice({ type: 'error', message: error.message }) })
      .finally(() => { if (!cancelled) setLoadingContext(false) })
    return () => { cancelled = true }
  }, [spaceId])

  const completedSections = useMemo(() => ['personal', 'learning', 'goals', 'response'].filter((section) => profileFields.some((field) => field.section === section && profile[field.key]?.trim())).length, [profile])
  const progress = completedSections * 25

  const goTo = (section) => {
    setActiveSection(section)
    document.getElementById(`personalization-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveProfileSection = async (section) => {
    const fields = profileFields.filter((field) => field.section === section)
    setSavingSection(section)
    setNotice(null)
    try {
      await Promise.all(fields.map((field) => {
        const current = memories.find((memory) => memory.key === field.key)
        const value = (profile[field.key] || '').trim()
        if (!value && current) return profileApi.deleteMemory(current.id)
        if (!value) return null
        const payload = { category: field.category, key: field.key, value, importance: 0.8 }
        return current ? profileApi.updateMemory(current.id, payload) : profileApi.createMemory(payload)
      }))
      await loadMemories()
      setNotice({ type: 'success', message: `${sectionInfo[section].title} saved to Global Long-term Memory.` })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setSavingSection('')
    }
  }

  const saveContext = async () => {
    if (!spaceId) return
    setSavingContext(true)
    setNotice(null)
    try {
      await spacesApi.updateContext(spaceId, fixedContext)
      setNotice({ type: 'success', message: `Workspace context saved for ${activeSpace?.name}.` })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setSavingContext(false)
    }
  }

  const saveMemory = async (event) => {
    event.preventDefault()
    const payload = { ...memoryForm, key: memoryForm.key.trim(), value: memoryForm.value.trim() }
    if (!payload.key || !payload.value) return
    setSavingSection('memory')
    try {
      if (editingId) await profileApi.updateMemory(editingId, payload)
      else await profileApi.createMemory(payload)
      await loadMemories()
      setMemoryForm(emptyMemory)
      setEditingId(null)
      setNotice({ type: 'success', message: 'Global memory saved.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setSavingSection('')
    }
  }

  const editMemory = (memory) => {
    const field = profileFields.find((item) => item.key === memory.key)
    if (field) { goTo(field.section); return }
    setMemoryForm({ category: memory.category, key: memory.key, value: memory.value, importance: memory.importance })
    setEditingId(memory.id)
    goTo('memory')
  }

  const deleteMemory = async (memory) => {
    if (!window.confirm(`Forget “${keyLabels[memory.key] || memory.key}”?`)) return
    try {
      await profileApi.deleteMemory(memory.id)
      await loadMemories()
      setNotice({ type: 'success', message: 'Memory forgotten.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const clearMemories = async () => {
    if (!window.confirm('Clear all Global Long-term Memory? This cannot be undone.')) return
    try {
      await profileApi.clearMemories()
      applyMemories([])
      setNotice({ type: 'success', message: 'All Global Long-term Memory cleared.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const previewStyle = profile.response_style || profile.learning_style || 'I’ll explain concepts clearly, step by step, with practical examples.'
  const previewGoal = profile.learning_goal || profile.long_term_goal

  return <main className="personalization-page text-ink">
    <header className="personalization-header"><div className="flex min-w-0 items-center gap-3"><BrandLogo className="h-10 w-10 rounded-xl border border-line bg-white p-0.5 shadow-sm" /><div className="min-w-0"><h1 className="truncate font-['Manrope'] text-[15px] font-bold">ICU Personalization</h1><p className="mt-0.5 text-[10px] text-muted">Personalize your AI experience</p></div></div><button onClick={() => onNavigate('/learn')} className="flex shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11px] font-semibold text-muted transition hover:border-brandblue/30 hover:text-brandblue"><ArrowLeft size={14} />Workspace</button></header>
    <div className="personalization-layout">
      <aside className="personalization-sidebar">
        <nav className="space-y-1">{sections.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} className={`flex min-h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[11px] font-semibold transition ${activeSection === id ? 'bg-brandblue/[.08] text-brandblue' : 'text-muted hover:bg-slate-50 hover:text-ink'}`}><Icon size={15} /><span className="min-w-0 flex-1 truncate">{label}</span>{id === 'memory' && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] shadow-sm">{memories.length}</span>}</button>)}</nav>
        <div className="personalization-sidebar-privacy"><div className="flex items-center gap-2 text-[11px] font-semibold"><ShieldCheck size={16} className="text-emerald-500" />ICU protects your data</div><p className="mt-2 text-[9px] leading-4 text-muted">Your information is only used to personalize your ICU experience.</p></div>
      </aside>

      <div className="personalization-main space-y-4">
        <section id="personalization-overview" className="personalization-hero scroll-mt-24"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-brandblue"><Sparkles size={13} />Personalize ICU</p><h2 className="mt-3 font-['Manrope'] text-2xl font-bold tracking-[-.025em] sm:text-[30px]">Let ICU understand you better.</h2><p className="mt-3 max-w-[560px] text-[13px] leading-6 text-muted">Tell ICU about your goals, preferences, and learning style. Selected information is remembered globally and used consistently across future conversations.</p></section>
        {notice && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}<span className="flex-1">{notice.message}</span><button onClick={() => setNotice(null)}>×</button></div>}

        <section className="personalization-progress-card"><div className="flex items-center justify-between gap-4"><div><h3 className="font-['Manrope'] text-sm font-bold">Personalization progress</h3><p className="mt-1 text-[11px] text-muted">Complete your profile for more relevant responses.</p></div><span className="text-sm font-bold text-brandblue">{progress}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brandblue transition-all" style={{ width: `${progress}%` }} /></div></section>

        <div className="personalization-dashboard-grid">
          <section className="personalization-dashboard-card"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-brandblue">Quick profile setup</p><h3 className="mt-1 font-['Manrope'] text-sm font-bold">Information ICU can learn</h3></div><span className="text-[10px] font-semibold text-muted">{completedSections}/4</span></div><div className="mt-4 space-y-1">{Object.entries(sectionInfo).map(([id, info]) => { const done = profileFields.some((field) => field.section === id && profile[field.key]?.trim()); const Icon = info.icon; return <button key={id} onClick={() => goTo(id)} className="flex min-h-[58px] w-full items-center gap-3 rounded-xl px-2.5 text-left transition hover:bg-slate-50"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brandblue/[.07] text-brandblue"><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{info.title}</span><span className={`mt-0.5 block text-[9px] ${done ? 'text-emerald-600' : 'text-muted'}`}>{done ? 'Completed' : 'In progress'}</span></span><ChevronRight size={14} className="text-slate-300" /></button> })}</div></section>
          <section className="personalization-dashboard-card"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-brandblue">Long-term Memory</p><h3 className="mt-1 font-['Manrope'] text-sm font-bold">Your global ICU profile</h3></div><span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span></div><p className="mt-3 text-[10px] leading-5 text-muted">ICU remembers this information and uses it across your conversations.</p><dl className="mt-4 space-y-3">{[['Name', profile.preferred_name], ['Role', profile.current_role], ['Learning level', profile.experience_level], ['Current goal', profile.learning_goal], ['Response style', profile.response_style]].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 text-[10px]"><dt className="text-muted">{label}</dt><dd className="truncate font-semibold text-ink">{value || 'Not set'}</dd></div>)}</dl><button onClick={() => goTo('memory')} className="mt-5 flex items-center gap-1 text-[10px] font-semibold text-brandblue">View all memories <ChevronRight size={13} /></button></section>
        </div>

        {Object.entries(sectionInfo).map(([section, info]) => { const Icon = info.icon; const fields = profileFields.filter((field) => field.section === section); return <section key={section} id={`personalization-${section}`} className="personalization-form-card scroll-mt-24"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brandblue/[.08] text-brandblue"><Icon size={18} /></span><div><h3 className="font-['Manrope'] text-base font-bold">{info.title}</h3><p className="mt-1 text-[11px] leading-5 text-muted">{info.description}</p></div></div><div className="personalization-form-grid mt-5">{fields.map((field) => <Field key={field.key} field={field} value={profile[field.key] || ''} onChange={(value) => setProfile((current) => ({ ...current, [field.key]: value }))} />)}</div><div className="mt-5 flex justify-end"><button onClick={() => saveProfileSection(section)} disabled={savingSection === section} className="flex items-center gap-2 rounded-xl bg-brandblue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#426de8] disabled:opacity-50">{savingSection === section ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}Save {info.title}</button></div></section> })}

        <section id="personalization-memory" className="personalization-form-card scroll-mt-24"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Brain size={18} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-['Manrope'] text-base font-bold">Global Long-term Memory</h3><span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span></div><p className="mt-1 text-[11px] leading-5 text-muted">Available to General Chat, every Learning Space, Research Agent, and future conversations.</p></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-muted">{memories.length}</span></div>
          {loading ? <div className="grid h-32 place-items-center"><LoaderCircle className="animate-spin text-brandblue" /></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{memories.map((memory) => <article key={memory.id} className="rounded-2xl border border-line p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-brandblue">{memory.category.replace('_', ' ')}</p><h4 className="mt-1 truncate text-xs font-bold">{keyLabels[memory.key] || memory.key}</h4></div><div className="flex"><button onClick={() => editMemory(memory)} className="rounded-lg p-1.5 text-slate-400 hover:bg-brandblue/[.06] hover:text-brandblue" aria-label="Edit memory"><Pencil size={13} /></button><button onClick={() => deleteMemory(memory)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Forget memory"><Trash2 size={13} /></button></div></div><p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-muted">{memory.value}</p><p className="mt-3 flex items-center gap-1 text-[9px] text-slate-400"><Globe2 size={11} />Used across chats</p></article>)}</div>}
          {!loading && !memories.length && <div className="mt-5 rounded-2xl border border-dashed border-line bg-slate-50/60 px-5 py-8 text-center"><Database className="mx-auto text-slate-300" /><p className="mt-3 text-xs font-semibold">No memories yet</p><p className="mt-1 text-[10px] text-muted">Complete a profile section or add a custom memory below.</p></div>}
          <form onSubmit={saveMemory} className="mt-5 rounded-2xl bg-canvas p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-brandblue">{editingId ? 'Edit memory' : 'Something else'}</p><h4 className="mt-1 text-xs font-bold">{editingId ? 'Update what ICU remembers' : 'Add something ICU should remember'}</h4></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setMemoryForm(emptyMemory) }} className="rounded-lg p-2 text-muted hover:bg-white"><X size={15} /></button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold text-slate-700">Information type<select value={memoryForm.category} onChange={(event) => setMemoryForm((current) => ({ ...current, category: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-xs outline-none focus:border-brandblue"><option value="fact">About you</option><option value="goal">Goal</option><option value="preference">Preference</option><option value="project">Project</option><option value="technical_decision">Technical decision</option><option value="other">Other</option></select></label><label className="text-[10px] font-semibold text-slate-700">Short title<input value={memoryForm.key} onChange={(event) => setMemoryForm((current) => ({ ...current, key: event.target.value }))} placeholder="What should ICU remember?" maxLength={120} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-xs outline-none focus:border-brandblue" /></label></div><label className="mt-3 block text-[10px] font-semibold text-slate-700">Details<textarea value={memoryForm.value} onChange={(event) => setMemoryForm((current) => ({ ...current, value: event.target.value }))} placeholder="Describe this in your own words..." rows={3} maxLength={2000} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-brandblue" /></label><div className="mt-3 flex justify-end"><button disabled={savingSection === 'memory' || !memoryForm.key.trim() || !memoryForm.value.trim()} className="flex items-center gap-2 rounded-xl bg-brandblue px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{savingSection === 'memory' ? <LoaderCircle size={14} className="animate-spin" /> : editingId ? <Save size={14} /> : <Plus size={14} />}{editingId ? 'Save changes' : 'Remember this'}</button></div></form>
        </section>

        <section id="personalization-workspace" className="personalization-form-card scroll-mt-24"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><BookOpen size={18} /></span><div><h3 className="font-['Manrope'] text-base font-bold">Workspace Context</h3><p className="mt-1 text-[11px] leading-5 text-muted">Project-specific information used only inside one Learning Space. This is separate from your global profile.</p></div></div><label className="mt-5 block text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Learning Space<select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} disabled={loadingSpaces || !learningSpaces.length} className="mt-2 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-brandblue"><option value="">Select a Learning Space</option>{learningSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>{loadingContext ? <div className="grid h-32 place-items-center"><LoaderCircle className="animate-spin text-brandblue" /></div> : <textarea value={fixedContext} onChange={(event) => setFixedContext(event.target.value)} disabled={!spaceId} rows={7} maxLength={12000} placeholder="Current syllabus, workspace objective, project constraints, important decisions..." className="mt-3 w-full resize-y rounded-2xl border border-line bg-canvas px-4 py-3.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-brandblue focus:bg-white" />}<div className="mt-3 flex items-center justify-between"><span className="text-[9px] text-muted">{fixedContext.length.toLocaleString()} / 12,000</span><button onClick={saveContext} disabled={!spaceId || savingContext} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold transition hover:border-brandblue/30 hover:text-brandblue disabled:opacity-40">{savingContext ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}Save workspace context</button></div></section>

        <section id="personalization-history" className="personalization-form-card scroll-mt-24"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-muted"><History size={18} /></span><div><h3 className="font-['Manrope'] text-base font-bold">Memory activity</h3><p className="mt-1 text-[11px] text-muted">Recent changes to your global ICU profile.</p></div></div><div className="mt-5 space-y-2">{[...memories].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8).map((memory) => <div key={memory.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3"><Clock3 size={14} className="text-slate-400" /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{keyLabels[memory.key] || memory.key}</p><p className="mt-0.5 text-[9px] text-muted">Memory added or updated</p></div><span className="text-[9px] text-slate-400">{humanDate(memory.updated_at)}</span></div>)}{!memories.length && <p className="py-6 text-center text-[11px] text-muted">No memory activity yet.</p>}</div></section>
      </div>

      <aside className="personalization-preview"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brandblue">AI preview</p><h2 className="mt-1 font-['Manrope'] text-base font-bold">Preview your personalized ICU</h2></div><section className="rounded-[18px] border border-line bg-[#f8faff] p-5"><BrandLogo className="h-12 w-12 rounded-2xl border border-line bg-white p-1 shadow-sm" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-brandblue">ICU will respond like this</p><p className="mt-3 text-[13px] leading-6 text-slate-700">{previewStyle}{previewGoal ? ` I’ll connect explanations to your goal: ${previewGoal}` : ''}</p></section><div className="space-y-3">{['Responds in your preferred style', 'Remembers your long-term goals', 'Recommends relevant information', 'Stays consistent across conversations'].map((item) => <div key={item} className="flex items-start gap-2 text-[11px] leading-5 text-muted"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={11} strokeWidth={3} /></span>{item}</div>)}</div><section className="rounded-[18px] border border-line p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Memory & Privacy</p><p className="mt-1 text-[9px] text-muted">Global memory is active</p></div><span className="relative h-6 w-11 rounded-full bg-brandblue"><span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm" /></span></div><div className="mt-4 border-t border-line pt-4"><div className="flex items-center justify-between text-[10px] text-muted"><span>Used automatically across chats</span><CheckCircle2 size={15} className="text-emerald-500" /></div></div><button onClick={() => goTo('memory')} className="mt-4 w-full rounded-xl border border-line px-3 py-2.5 text-[10px] font-semibold text-ink hover:border-brandblue/30 hover:text-brandblue">View all memories</button><button onClick={clearMemories} disabled={!memories.length} className="mt-2 w-full rounded-xl px-3 py-2.5 text-[10px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-30">Clear all Long-term Memory</button></section><section className="rounded-[18px] border border-brandblue/10 bg-brandblue/[.04] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold"><Globe2 size={15} className="text-brandblue" />One profile, every ICU mode</div><p className="mt-2 text-[10px] leading-5 text-muted">Global memory follows you into General Chat, Learning Spaces, document Q&amp;A, and research. Workspace Context stays local to its selected space.</p></section></aside>
    </div>
  </main>
}
