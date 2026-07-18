'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Briefcase, Users, Eye, Trash2, RefreshCw, ArrowRight, Edit3, Save, X, Building2, Clock } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_MODES, EXPERIENCE_LEVELS, APPLICATION_STATUSES, labelFrom, formatSalary, daysUntil } from '@/lib/jobs'
import { SECTORS, GOVERNORATES } from '@/lib/directory'

export default function EmployerClient() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [companies, setCompanies] = useState([])
  const [jobs, setJobs] = useState([])
  const [newOpen, setNewOpen] = useState(false)
  const [applicantsFor, setApplicantsFor] = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signup?next=/jobs/employer'); return }
    if (status !== 'authenticated') return
    load()

  }, [status])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/employer/jobs')
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'خطأ'); setErrorCode(d.code || ''); return }
      setCompanies(d.companies || [])
      setJobs(d.items || [])
    } finally { setLoading(false) }
  }

  if (loading) return <div className="py-16 text-center">جارٍ التحميل...</div>
  if (error && errorCode === 'NO_COMPANY') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <Building2 className="mx-auto h-14 w-14 text-gray-400" />
        <h1 className="mt-4 text-xl font-bold text-[#1B3A6B]">سجّل شركتك أولاً</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <Link href="/directory/add-company" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2.5 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> أضف شركتي للدليل
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]">
        <ArrowRight className="h-4 w-4" /> لوحة الوظائف
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B]">إدارة إعلانات الوظائف</h1>
          <p className="text-sm text-gray-500">{jobs.length} إعلان</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B]">
          <Plus className="h-4 w-4" /> وظيفة جديدة
        </button>
        <Link href="/jobs/employer/search" className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1B3A6B] px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
          <Users className="h-4 w-4" /> ابحث عن مرشحين
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-12 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm font-semibold text-gray-700">لم تنشر إعلانات بعد</p>
          <button onClick={() => setNewOpen(true)} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> أنشئ أول إعلان
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => <EmployerRow key={j.id} job={j} onChanged={load} onApplicants={() => setApplicantsFor(j)} />)}
        </div>
      )}

      {newOpen && <NewJobModal companies={companies} onClose={() => setNewOpen(false)} onSaved={load} />}
      {applicantsFor && <ApplicantsModal job={applicantsFor} onClose={() => setApplicantsFor(null)} />}
    </div>
  )
}

function EmployerRow({ job, onChanged, onApplicants }) {
  const [busy, setBusy] = useState('')
  const del = async () => {
    if (!confirm('حذف هذا الإعلان وجميع التقديمات؟')) return
    setBusy('del')
    await fetch(`/api/employer/jobs/${job.id}`, { method: 'DELETE' })
    setBusy(''); onChanged()
  }
  const extend = async () => {
    setBusy('extend')
    await fetch(`/api/employer/jobs/${job.id}/extend`, { method: 'POST' })
    setBusy(''); onChanged()
  }
  const toggle = async () => {
    setBusy('toggle')
    await fetch(`/api/employer/jobs/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: job.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE' }) })
    setBusy(''); onChanged()
  }
  const daysLeft = daysUntil(job.applyDeadline)
  const salary = formatSalary(job)
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-[#1B3A6B]">{job.titleAr}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${job.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : job.status === 'EXPIRED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
              {job.status === 'ACTIVE' ? 'نشط' : job.status === 'EXPIRED' ? 'منتهي' : 'مغلق'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
            <span>{labelFrom(EMPLOYMENT_TYPES, job.employmentType)}</span>
            <span>•</span>
            <span>{labelFrom(WORK_MODES, job.workMode)}</span>
            <span>•</span>
            <span>{job.governorate}</span>
            {salary && <><span>•</span><span className="text-emerald-700">{salary}</span></>}
            {daysLeft !== null && <><span>•</span><span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" /> {daysLeft > 0 ? `${daysLeft} يوم` : 'منتهي'}</span></>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={onApplicants} className="inline-flex items-center gap-1 rounded-md bg-[#1B3A6B]/10 px-2.5 py-1 text-xs font-semibold text-[#1B3A6B]">
            <Users className="h-3 w-3" /> {job.applicantsCount} متقدم
          </button>
          <button onClick={extend} disabled={busy === 'extend'} className="rounded-md border px-2.5 py-1 text-xs"><RefreshCw className="inline h-3 w-3" /> +30 يوم</button>
          <button onClick={toggle} disabled={busy === 'toggle'} className="rounded-md border px-2.5 py-1 text-xs">{job.status === 'ACTIVE' ? 'إغلاق' : 'إعادة فتح'}</button>
          <button onClick={del} disabled={busy === 'del'} className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600"><Trash2 className="h-3 w-3" /></button>
          <Link href={`/jobs/${job.id}`} className="rounded-md border px-2.5 py-1 text-xs"><Eye className="h-3 w-3" /></Link>
        </div>
      </div>
    </div>
  )
}

function NewJobModal({ companies, onClose, onSaved }) {
  const [form, setForm] = useState({
    companyId: companies[0]?.id || '', titleAr: '', descriptionAr: '',
    sector: '', governorate: '', city: '',
    employmentType: 'FULL_TIME', workMode: 'ONSITE', experienceLevel: 'MID',
    salaryMin: 0, salaryMax: 0, salaryHidden: false,
    requirements: [], responsibilities: [], benefits: [], skills: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [reqText, setReqText] = useState('')
  const [respText, setRespText] = useState('')
  const [benText, setBenText] = useState('')

  const save = async () => {
    setSaving(true); setError('')
    const payload = {
      ...form,
      skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
      requirements: reqText.split('\n').map((s) => s.trim()).filter(Boolean),
      responsibilities: respText.split('\n').map((s) => s.trim()).filter(Boolean),
      benefits: benText.split('\n').map((s) => s.trim()).filter(Boolean),
    }
    const res = await fetch('/api/employer/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error || 'خطأ'); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 my-8 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1B3A6B]">إعلان وظيفة جديدة</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="space-y-3">
          <SelectField label="الشركة" value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} options={companies.map((c) => ({ key: c.id, ar: c.nameAr }))} />
          <Input label="عنوان الوظيفة *" value={form.titleAr} onChange={(v) => setForm({ ...form, titleAr: v })} />
          <div>
            <label className="block text-xs font-medium">الوصف التفصيلي *</label>
            <textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} rows={5} className="mt-1 w-full rounded-lg border p-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="القطاع *" value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} options={SECTORS.map((s) => ({ key: s.key, ar: s.nameAr }))} />
            <SelectField label="المحافظة *" value={form.governorate} onChange={(v) => setForm({ ...form, governorate: v })} options={GOVERNORATES.map((g) => ({ key: g.key, ar: g.nameAr }))} />
            <Input label="المدينة" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <SelectField label="نوع الدوام" value={form.employmentType} onChange={(v) => setForm({ ...form, employmentType: v })} options={EMPLOYMENT_TYPES} />
            <SelectField label="أسلوب العمل" value={form.workMode} onChange={(v) => setForm({ ...form, workMode: v })} options={WORK_MODES} />
            <SelectField label="الخبرة" value={form.experienceLevel} onChange={(v) => setForm({ ...form, experienceLevel: v })} options={EXPERIENCE_LEVELS} />
            <Input label="أقل راتب (ر.ع)" type="number" value={form.salaryMin} onChange={(v) => setForm({ ...form, salaryMin: Number(v) })} />
            <Input label="أعلى راتب (ر.ع)" type="number" value={form.salaryMax} onChange={(v) => setForm({ ...form, salaryMax: Number(v) })} />
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.salaryHidden} onChange={(e) => setForm({ ...form, salaryHidden: e.target.checked })} /> إخفاء الراتب من الإعلان</label>
          <div>
            <label className="block text-xs font-medium">المهارات (مفصولة بفواصل)</label>
            <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium">المسؤوليات (سطر لكل واحدة)</label>
            <textarea value={respText} onChange={(e) => setRespText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium">المتطلبات (سطر لكل واحد)</label>
            <textarea value={reqText} onChange={(e) => setReqText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium">المزايا (سطر لكل واحدة)</label>
            <textarea value={benText} onChange={(e) => setBenText(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border p-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            نشر الإعلان
          </button>
        </div>
      </div>
    </div>
  )
}

function ApplicantsModal({ job, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/employer/jobs/${job.id}/applicants`)
    const d = await res.json()
    setItems(d.items || [])
    setLoading(false)
  }

  const setStatus = async (appId, status) => {
    await fetch(`/api/employer/applications/${appId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 my-8 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1B3A6B]">المتقدمون لـ: {job.titleAr}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {loading ? <div className="py-8 text-center text-gray-500">جارٍ التحميل...</div> : items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-500">لا يوجد متقدمون بعد</div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => <ApplicantRow key={a.id} app={a} onStatus={setStatus} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ApplicantRow({ app, onStatus }) {
  const s = APPLICATION_STATUSES.find((x) => x.key === app.status)
  const seek = app.seekerSnapshot || {}
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border bg-gray-100">
          {seek.photo ? <img src={seek.photo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-400">{(seek.fullName || '?').charAt(0)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-[#1B3A6B]">{seek.fullName || 'متقدم'}</h4>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${s?.color || 'bg-gray-100'}`}>{s?.ar || app.status}</span>
          </div>
          <p className="text-xs text-gray-500">{seek.title || ''} • {seek.yearsOfExperience || 0} سنة خبرة</p>
          <p className="mt-1 text-xs text-gray-500" dir="ltr">{seek.email} {seek.phone && `• ${seek.phone}`}</p>
          {seek.skills?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {seek.skills.slice(0, 6).map((sk) => <span key={sk} className="rounded-full bg-[#1B3A6B]/8 px-2 py-0.5 text-[10px] text-[#1B3A6B]">{sk}</span>)}
            </div>
          )}
          {app.coverLetter && <div className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">{app.coverLetter}</div>}
          {seek.links?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {seek.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-0.5 text-blue-600 hover:underline">{l.label}</a>)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t pt-3">
        {APPLICATION_STATUSES.filter((x) => !['WITHDRAWN'].includes(x.key)).map((s) => (
          <button key={s.key} onClick={() => onStatus(app.id, s.key)} disabled={app.status === s.key} className={`rounded-full px-3 py-1 text-[10px] ${app.status === s.key ? 'bg-[#1B3A6B] text-white' : 'border hover:border-[#1B3A6B]'}`}>
            {s.ar}
          </button>
        ))}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
    </label>
  )
}
function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border bg-white p-2 text-sm">
        <option value="">اختر...</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.ar}</option>)}
      </select>
    </label>
  )
}
