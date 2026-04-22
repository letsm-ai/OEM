'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X, CheckCircle2 } from 'lucide-react'
import { SPECIALTIES } from '@/lib/experts'

const MAX_PHOTO = 500 * 1024
const MAX_CV = 2 * 1024 * 1024 // 2MB for CV

export default function BecomeExpertForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    specialty: '',
    specialtyAr: '',
    bio: '',
    experienceYears: '',
    hourlyRate: '',
    photo: '',
    cv: '',
    cvName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('يجب أن تكون الصورة ملف صور')
    if (f.size > MAX_PHOTO) return setError('حجم الصورة أكبر من 500كب')
    const r = new FileReader()
    r.onload = () => {
      setError('')
      setForm((x) => ({ ...x, photo: r.result }))
    }
    r.readAsDataURL(f)
  }
  const onCV = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_CV) return setError('حجم الملف أكبر من 2ميجابايت')
    const r = new FileReader()
    r.onload = () => {
      setError('')
      setForm((x) => ({ ...x, cv: r.result, cvName: f.name }))
    }
    r.readAsDataURL(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.specialty || !form.hourlyRate) {
      setError('التخصص وسعر الساعة مطلوبان')
      return
    }
    const rate = parseFloat(form.hourlyRate)
    if (isNaN(rate) || rate <= 0) return setError('سعر الساعة غير صحيح')

    setLoading(true)
    const sp = SPECIALTIES.find((s) => s.key === form.specialty)
    const payload = {
      specialty: form.specialty,
      specialtyAr: form.specialtyAr || sp?.nameAr || '',
      bio: form.bio,
      experienceYears: parseInt(form.experienceYears) || 0,
      hourlyRate: rate,
      photo: form.photo,
      cv: form.cv,
    }
    try {
      const res = await fetch('/api/experts/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'تعذر الإرسال')
      else {
        setDone(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setError('خطأ في الشبكة')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-green-800">تم إرسال طلبك بنجاح</h3>
        <p className="mt-1 text-sm text-green-700">
          سنبلّغك فور اعتماده. جاري تحويلك...
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          صورة شخصية (اختياري، 500كب)
        </label>
        <div className="flex items-center gap-4">
          {form.photo ? (
            <div className="relative">
              <img src={form.photo} className="h-20 w-20 rounded-full border-2 border-gray-200 object-cover" />
              <button
                type="button"
                onClick={() => setForm({ ...form, photo: '' })}
                className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-[#F8F9FA] text-gray-400">
              <Upload className="h-6 w-6" />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            اختر صورة
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="التخصص *">
          <select
            required
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            className="input"
          >
            <option value="">اختر التخصص</option>
            {SPECIALTIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.emoji} {s.nameAr}
              </option>
            ))}
          </select>
        </Field>
        <Field label="سنوات الخبرة">
          <input
            type="number"
            min={0}
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
            className="input"
            placeholder="5"
          />
        </Field>
        <Field label="سعر الساعة (ر.ع) *">
          <input
            type="number"
            min={1}
            step={0.5}
            required
            value={form.hourlyRate}
            onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
            className="input"
            placeholder="25"
          />
        </Field>
        <Field label="وصف دقيق للتخصص (اختياري)">
          <input
            value={form.specialtyAr}
            onChange={(e) => setForm({ ...form, specialtyAr: e.target.value })}
            className="input"
            placeholder="مثال: استشاري قانوني شركات"
          />
        </Field>
      </div>

      <Field label="السيرة الذاتية / نبذة مهنية">
        <textarea
          rows={4}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="input"
          placeholder="تحدّث عن خبراتك ومجال تميّزك"
        />
      </Field>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          السيرة الذاتية / شهادات (اختياري، 2ميجا)
        </label>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {form.cvName || 'اختر ملف PDF/صورة'}
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={onCV}
              className="hidden"
            />
          </label>
          {form.cv && (
            <button
              type="button"
              onClick={() => setForm({ ...form, cv: '', cvName: '' })}
              className="text-xs text-red-600 hover:underline"
            >
              حذف
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...
            </>
          ) : (
            'إرسال الطلب'
          )}
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #1b3a6b;
          box-shadow: 0 0 0 3px rgba(27, 58, 107, 0.1);
        }
      `}</style>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
