'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X, CheckCircle2 } from 'lucide-react'
import { SECTORS, GOVERNORATES } from '@/lib/directory'

const MAX_LOGO_BYTES = 500 * 1024 // 500KB raw

export default function AddCompanyForm({ initial = null, companyId = null }) {
  const router = useRouter()
  const [form, setForm] = useState({
    nameAr: initial?.nameAr || '',
    nameEn: initial?.nameEn || '',
    sector: initial?.sector || '',
    governorate: initial?.governorate || '',
    description: initial?.description || '',
    services: (initial?.services || []).join('، '),
    phone: initial?.phone || '',
    email: initial?.email || '',
    website: initial?.website || '',
    location: initial?.location || '',
    lat: typeof initial?.lat === 'number' ? String(initial.lat) : '',
    lng: typeof initial?.lng === 'number' ? String(initial.lng) : '',
    logo: initial?.logo || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [locating, setLocating] = useState(false)

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }))
        setLocating(false)
      },
      (err) => {
        setError(err.message || 'تعذر تحديد الموقع')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const clearLatLng = () =>
    setForm((f) => ({ ...f, lat: '', lng: '' }))

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('الشعار يجب أن يكون صورة')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('حجم الشعار أكبر من 500KB. يرجى اختيار صورة أصغر.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setError('')
      setForm((f) => ({ ...f, logo: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const clearLogo = () => setForm((f) => ({ ...f, logo: '' }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nameAr || !form.sector) {
      setError('اسم الشركة العربي والقطاع مطلوبان')
      return
    }
    setLoading(true)

    const payload = {
      ...form,
      services: form.services
        .split(/[،,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      lat: form.lat === '' ? null : Number(form.lat),
      lng: form.lng === '' ? null : Number(form.lng),
    }

    const url = companyId ? `/api/companies/${companyId}` : '/api/companies'
    const method = companyId ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'تعذر حفظ الشركة')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/directory/my-companies'), 1500)
      }
    } catch {
      setError('خطأ في الشبكة، حاول مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-green-800">
          تم حفظ بيانات الشركة بنجاح
        </h3>
        <p className="mt-1 text-sm text-green-700">
          ستمر الشركة بمراجعة الإدارة قبل عرضها في الدليل. جاري تحويلك...
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Logo */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          شعار الشركة (اختياري، حد أقصى 500كب)
        </label>
        <div className="flex items-center gap-4">
          {form.logo ? (
            <div className="relative">
              <img
                src={form.logo}
                alt="logo"
                className="h-20 w-20 rounded-xl border-2 border-gray-200 object-cover"
              />
              <button
                type="button"
                onClick={clearLogo}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-[#F8F9FA] text-gray-400">
              <Upload className="h-6 w-6" />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            اختر صورة
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="اسم الشركة (عربي) *">
          <input
            required
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            className="input"
            placeholder="مثال: شركة عمان للتقنية"
          />
        </Field>
        <Field label="اسم الشركة (English)">
          <input
            dir="ltr"
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            className="input text-right"
            placeholder="Oman Tech Co."
          />
        </Field>
        <Field label="القطاع *">
          <select
            required
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            className="input"
          >
            <option value="">اختر القطاع</option>
            {SECTORS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.emoji} {s.nameAr}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المحافظة">
          <select
            value={form.governorate}
            onChange={(e) => setForm({ ...form, governorate: e.target.value })}
            className="input"
          >
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((g) => (
              <option key={g.key} value={g.key}>
                {g.nameAr}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="وصف الشركة">
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
          placeholder="نبذة مختصرة عن نشاط الشركة وأهدافها"
        />
      </Field>

      <Field
        label="الخدمات (افصل بينها بفاصلة عربية ،)"
        hint="مثال: تطوير تطبيقات، استضافة، استشارات تقنية"
      >
        <input
          value={form.services}
          onChange={(e) => setForm({ ...form, services: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="الهاتف">
          <input
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input text-right"
            placeholder="+968 9XXX XXXX"
          />
        </Field>
        <Field label="البريد الإلكتروني">
          <input
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input text-right"
            placeholder="contact@company.com"
          />
        </Field>
        <Field label="الموقع الإلكتروني">
          <input
            dir="ltr"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="input text-right"
            placeholder="https://company.com"
          />
        </Field>
        <Field label="العنوان">
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input"
            placeholder="مثال: الحي التجاري، الغبرة"
          />
        </Field>
      </div>

      {/* Location coordinates */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-[#F8F9FA] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-[#1B3A6B]">
              إحداثيات دقيقة (اختياري)
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              لتظهر شركتك في مكانها الدقيق على خريطة الدليل. اتركها فارغة
              لاستخدام مركز المحافظة كموقع تقريبي.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex items-center gap-1 rounded-lg border border-[#1B3A6B] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B]/5 disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span>📍</span>
              )}
              استخدم موقعي
            </button>
            {(form.lat || form.lng) && (
              <button
                type="button"
                onClick={clearLatLng}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-3 w-3" />
                مسح
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="خط العرض (Latitude)" hint="مثال: 23.588">
            <input
              dir="ltr"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              className="input text-right"
              placeholder="23.588"
              inputMode="decimal"
            />
          </Field>
          <Field label="خط الطول (Longitude)" hint="مثال: 58.383">
            <input
              dir="ltr"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              className="input text-right"
              placeholder="58.383"
              inputMode="decimal"
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#152c52] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : companyId ? (
            'حفظ التعديلات'
          ) : (
            'إرسال للمراجعة'
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
          transition: all 0.15s;
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
