'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, User, Plus, Trash2, Camera, CheckCircle2, ArrowRight } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_MODES, EDUCATION_LEVELS } from '@/lib/jobs'
import { SECTORS, GOVERNORATES } from '@/lib/directory'

const BLANK_EXP = { title: '', company: '', from: '', to: '', description: '' }
const BLANK_LINK = { label: '', url: '' }

export default function SeekerProfileClient() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '', title: '', bio: '', photo: '', yearsOfExperience: 0,
    currentPosition: '', currentCompany: '',
    desiredSectors: [], desiredGovernorates: [], workModePref: [], employmentTypePref: [],
    educationLevel: '', educationSummary: '',
    experience: [], skills: [], languages: [], links: [],
    phone: '', openToWork: true, profileVisibility: 'PUBLIC',
  })
  const [skillsText, setSkillsText] = useState('')
  const [langsText, setLangsText] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signup?next=/jobs/my-profile')
      return
    }
    if (status !== 'authenticated') return
    ;(async () => {
      try {
        const res = await fetch('/api/me/job-seeker')
        const d = await res.json()
        if (d.profile) {
          setForm({ ...form, ...d.profile })
          setSkillsText((d.profile.skills || []).join(', '))
          setLangsText((d.profile.languages || []).join(', '))
        }
      } catch (e) { /* silent */ } finally {
        setLoading(false)
      }
    })()

  }, [status])

  const upload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { setError('حجم الصورة يجب أن لا يتجاوز 3ميجا'); return }
    const r = new FileReader()
    r.onload = () => setForm({ ...form, photo: r.result })
    r.readAsDataURL(f)
  }

  const toggleArr = (field, val) => {
    const arr = form[field] || []
    if (arr.includes(val)) setForm({ ...form, [field]: arr.filter((x) => x !== val) })
    else setForm({ ...form, [field]: [...arr, val] })
  }

  const save = async () => {
    if (!form.fullName?.trim()) { setError('الاسم الكامل مطلوب'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
        languages: langsText.split(',').map((s) => s.trim()).filter(Boolean),
      }
      const res = await fetch('/api/me/job-seeker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'خطأ'); return }
      setFlash('تم حفظ ملفك بنجاح!')
      setTimeout(() => setFlash(''), 4000)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="py-16 text-center text-gray-500">جارٍ التحميل...</div>

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]">
        <ArrowRight className="h-4 w-4" /> عودة للوظائف
      </Link>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-[#1B3A6B]">ملفي المهني</h1>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ
        </button>
      </div>
      {flash && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="inline h-4 w-4" /> {flash}</div>}
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Basic info */}
      <Section title="المعلومات الأساسية">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
              {form.photo ? (
                
                <img src={form.photo} alt="" className="h-full w-full object-cover" />
              ) : <User className="m-auto mt-6 h-10 w-10 text-gray-400" />}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <Camera className="h-3 w-3" /> تغيير
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={upload} hidden />
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Input label="الاسم الكامل *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <Input label="المسمّى الوظيفي" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="مثال: مطور واجهات" />
            <Input label="رقم الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} dir="ltr" />
            <Input label="سنوات الخبرة" type="number" value={form.yearsOfExperience} onChange={(v) => setForm({ ...form, yearsOfExperience: Number(v) })} />
            <Input label="المنصب الحالي" value={form.currentPosition} onChange={(v) => setForm({ ...form, currentPosition: v })} />
            <Input label="الشركة الحالية" value={form.currentCompany} onChange={(v) => setForm({ ...form, currentCompany: v })} />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700">مقدمة قصيرة (400 حرف)</label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={400} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm" placeholder="تعريف مختصر عن نفسك ومهاراتك" />
        </div>
      </Section>

      {/* Education */}
      <Section title="المؤهل العلمي">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="الدرجة" value={form.educationLevel} onChange={(v) => setForm({ ...form, educationLevel: v })} options={EDUCATION_LEVELS} />
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700">تفاصيل (جامعة، تخصص، سنوات)</label>
          <textarea value={form.educationSummary} onChange={(e) => setForm({ ...form, educationSummary: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm" />
        </div>
      </Section>

      {/* Experience */}
      <Section title="الخبرات العملية">
        <div className="space-y-3">
          {(form.experience || []).map((ex, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input label="المسمّى" value={ex.title} onChange={(v) => updateArrItem(form, setForm, 'experience', i, { ...ex, title: v })} />
                <Input label="الشركة" value={ex.company} onChange={(v) => updateArrItem(form, setForm, 'experience', i, { ...ex, company: v })} />
                <Input label="من (YYYY-MM)" value={ex.from} onChange={(v) => updateArrItem(form, setForm, 'experience', i, { ...ex, from: v })} placeholder="2020-01" />
                <Input label="إلى" value={ex.to} onChange={(v) => updateArrItem(form, setForm, 'experience', i, { ...ex, to: v })} placeholder="حتى الآن" />
              </div>
              <textarea value={ex.description} onChange={(e) => updateArrItem(form, setForm, 'experience', i, { ...ex, description: e.target.value })} rows={2} placeholder="وصف المهام" className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-xs" />
              <button type="button" onClick={() => setForm({ ...form, experience: form.experience.filter((_, x) => x !== i) })} className="mt-2 text-xs text-red-600 hover:underline">
                <Trash2 className="inline h-3 w-3" /> حذف
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, experience: [...form.experience, { ...BLANK_EXP }] })} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-400 px-3 py-2 text-xs"><Plus className="h-3 w-3" /> إضافة خبرة</button>
        </div>
      </Section>

      {/* Skills & Languages */}
      <Section title="المهارات واللغات">
        <label className="block text-xs font-medium">المهارات (افصلها بفاصلة)</label>
        <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm" placeholder="React, Node.js, التسويق الرقمي" />
        <label className="mt-3 block text-xs font-medium">اللغات</label>
        <input value={langsText} onChange={(e) => setLangsText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm" placeholder="العربية، الإنجليزية" />
      </Section>

      {/* Preferences */}
      <Section title="تفضيلاتي">
        <MultiChips label="مجالات العمل المفضّلة" value={form.desiredSectors} options={SECTORS.map(s => ({ key: s.key, ar: s.nameAr }))} onToggle={(v) => toggleArr('desiredSectors', v)} />
        <MultiChips label="المحافظات" value={form.desiredGovernorates} options={GOVERNORATES.map(g => ({ key: g.key, ar: g.nameAr }))} onToggle={(v) => toggleArr('desiredGovernorates', v)} />
        <MultiChips label="أسلوب العمل" value={form.workModePref} options={WORK_MODES} onToggle={(v) => toggleArr('workModePref', v)} />
        <MultiChips label="نوع الدوام" value={form.employmentTypePref} options={EMPLOYMENT_TYPES} onToggle={(v) => toggleArr('employmentTypePref', v)} />
      </Section>

      {/* Links */}
      <Section title="روابط خاصة">
        <div className="space-y-2">
          {(form.links || []).map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.label} onChange={(e) => updateArrItem(form, setForm, 'links', i, { ...l, label: e.target.value })} placeholder="LinkedIn / الموقع / GitHub" className="w-40 rounded-lg border p-2 text-sm" />
              <input value={l.url} onChange={(e) => updateArrItem(form, setForm, 'links', i, { ...l, url: e.target.value })} placeholder="https://..." dir="ltr" className="flex-1 rounded-lg border p-2 text-sm" />
              <button type="button" onClick={() => setForm({ ...form, links: form.links.filter((_, x) => x !== i) })} className="rounded border px-2 text-xs text-red-600"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, links: [...(form.links || []), { ...BLANK_LINK }] })} className="inline-flex items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-xs"><Plus className="h-3 w-3" /> إضافة رابط</button>
        </div>
      </Section>

      {/* Availability */}
      <Section title="التوافر">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.openToWork} onChange={(e) => setForm({ ...form, openToWork: e.target.checked })} className="h-4 w-4 accent-[#1B3A6B]" />
          <span>متاح للعمل الآن</span>
        </label>
      </Section>

      <div className="mt-6 flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-6 py-3 font-bold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الملف
        </button>
      </div>
    </div>
  )
}

function updateArrItem(form, setForm, field, idx, newVal) {
  const arr = [...(form[field] || [])]
  arr[idx] = newVal
  setForm({ ...form, [field]: arr })
}

function Section({ title, children }) {
  return (
    <div className="mb-4 rounded-xl border bg-white p-5">
      <h2 className="mb-3 text-sm font-bold text-[#1B3A6B]">{title}</h2>
      {children}
    </div>
  )
}
function Input({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-[#1B3A6B] focus:outline-none" {...rest} />
    </label>
  )
}
function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm">
        <option value="">اختر...</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.ar}</option>)}
      </select>
    </label>
  )
}
function MultiChips({ label, value, options, onToggle }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-gray-700">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = (value || []).includes(o.key)
          return (
            <button key={o.key} type="button" onClick={() => onToggle(o.key)} className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-[#1B3A6B] text-white' : 'border border-gray-300 bg-white text-gray-700 hover:border-[#1B3A6B]'}`}>
              {o.ar}
            </button>
          )
        })}
      </div>
    </div>
  )
}
