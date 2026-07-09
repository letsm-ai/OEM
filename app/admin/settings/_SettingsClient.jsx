'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  Save,
  DollarSign,
  Percent,
  Calendar,
  Gift,
  Zap,
  Phone,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

const TIERS = ['BASIC', 'GOLD', 'PLATINUM']
const TIER_LABELS = { BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }

function toInputDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function SettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [s, setS] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' })
      if (res.status === 401) {
        window.location.href =
          '/login?callbackUrl=' + encodeURIComponent('/admin/settings')
        return
      }
      if (res.status === 403) {
        setToast({ type: 'error', msg: 'صلاحيات غير كافية — تحتاج حساب أدمن' })
        return
      }
      const d = await res.json()
      if (res.ok) setS(d.settings)
      else setToast({ type: 'error', msg: friendlyError(d.error) })
    } catch {
      setToast({ type: 'error', msg: 'تعذّر الاتصال بالخادم' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setToast(null)
    try {
      const payload = {
        tierPrices: s.tierPrices,
        tierDiscounts: s.tierDiscounts,
        membershipDurationDays: s.membershipDurationDays,
        trial: s.trial,
        freeMode: {
          ...s.freeMode,
          startDate: s.freeMode.startDate || null,
          endDate: s.freeMode.endDate || null,
        },
        codFeeOmr: s.codFeeOmr,
        supportEmail: s.supportEmail,
        supportWhatsapp: s.supportWhatsapp,
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        setToast({
          type: 'error',
          msg: 'انتهت جلستك — سيتم توجيهك لتسجيل الدخول',
        })
        setTimeout(() => {
          window.location.href =
            '/login?callbackUrl=' + encodeURIComponent('/admin/settings')
        }, 1500)
        return
      }
      if (res.status === 403) {
        setToast({ type: 'error', msg: 'صلاحيات غير كافية — تحتاج حساب أدمن' })
        return
      }
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast({ type: 'error', msg: friendlyError(d.error) })
        return
      }
      setS(d.settings)
      setToast({
        type: 'ok',
        msg: 'تم الحفظ بنجاح! التغييرات فعّالة خلال 30 ثانية للجميع.',
      })
      setTimeout(() => setToast(null), 5000)
    } catch {
      setToast({ type: 'error', msg: 'تعذّر الاتصال بالخادم' })
    } finally {
      setSaving(false)
    }
  }

  // Map raw backend error codes to friendly Arabic messages
  function friendlyError(code) {
    const map = {
      auth: 'انتهت جلستك — الرجاء تسجيل الدخول مجدداً',
      forbidden: 'صلاحيات غير كافية — تحتاج حساب أدمن',
      no_changes: 'لم تُعدَّل أي حقول',
    }
    return map[code] || code || 'تعذّر الحفظ'
  }

  if (loading || !s) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A6B]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            toast.type === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* ---- Free mode ---- */}
      <Section icon={Zap} title="وضع المجانية الشامل" accent="amber" desc="فعّل هذا الوضع لتجعل الباقات المدحددة مجانية خلال فترة معيّنة">
        <Toggle
          label="تفعيل المجانية الشاملة"
          checked={s.freeMode.enabled}
          onChange={(v) => setS({ ...s, freeMode: { ...s.freeMode, enabled: v } })}
        />
        {s.freeMode.enabled && (
          <div className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="تاريخ البداية (اختياري)" hint="إذا فرغ → يبدأ فوراً">
                <input
                  type="date"
                  value={toInputDate(s.freeMode.startDate)}
                  onChange={(e) => setS({ ...s, freeMode: { ...s.freeMode, startDate: e.target.value } })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
                />
              </Field>
              <Field label="تاريخ الانتهاء (اختياري)" hint="إذا فرغ → يستمر إلى ما توقفه">
                <input
                  type="date"
                  value={toInputDate(s.freeMode.endDate)}
                  onChange={(e) => setS({ ...s, freeMode: { ...s.freeMode, endDate: e.target.value } })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
                />
              </Field>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">الباقات المجانية خلال هذه الفترة</label>
              <div className="flex flex-wrap gap-2">
                {TIERS.map((t) => {
                  const on = s.freeMode.includedTiers.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const set = new Set(s.freeMode.includedTiers)
                        on ? set.delete(t) : set.add(t)
                        setS({
                          ...s,
                          freeMode: { ...s.freeMode, includedTiers: [...set] },
                        })
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        on
                          ? 'bg-[#C9A84C] text-[#1B3A6B]'
                          : 'bg-white text-gray-500 ring-1 ring-gray-300'
                      }`}
                    >
                      {TIER_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="رسالة البانر (عربي)">
                <input
                  type="text"
                  value={s.freeMode.bannerAr}
                  placeholder="مثلاً: جميع الباقات مجانية حتى نهاية الشهر!"
                  onChange={(e) => setS({ ...s, freeMode: { ...s.freeMode, bannerAr: e.target.value } })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
                />
              </Field>
              <Field label="Banner message (English)">
                <input
                  type="text"
                  dir="ltr"
                  value={s.freeMode.bannerEn}
                  placeholder="e.g. All plans FREE until end of month!"
                  onChange={(e) => setS({ ...s, freeMode: { ...s.freeMode, bannerEn: e.target.value } })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
                />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ---- Tier prices ---- */}
      <Section icon={DollarSign} title="أسعار الباقات (ر.ع)" accent="blue">
        <div className="grid gap-3 md:grid-cols-3">
          {TIERS.map((t) => (
            <Field key={t} label={TIER_LABELS[t]}>
              <input
                type="number"
                min={0}
                step="0.001"
                value={s.tierPrices[t]}
                onChange={(e) => setS({ ...s, tierPrices: { ...s.tierPrices, [t]: Number(e.target.value) } })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* ---- Tier discounts ---- */}
      <Section icon={Percent} title="نسب الخصم لكل باقة (%)" accent="green">
        <div className="grid gap-3 md:grid-cols-3">
          {TIERS.map((t) => (
            <Field key={t} label={TIER_LABELS[t]}>
              <input
                type="number"
                min={0}
                max={100}
                step="1"
                value={s.tierDiscounts[t]}
                onChange={(e) => setS({ ...s, tierDiscounts: { ...s.tierDiscounts, [t]: Number(e.target.value) } })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* ---- Duration ---- */}
      <Section icon={Calendar} title="مدة الاشتراك">
        <Field label="عدد الأيام (إفتراضياً 365)">
          <input
            type="number"
            min={1}
            value={s.membershipDurationDays}
            onChange={(e) => setS({ ...s, membershipDurationDays: Number(e.target.value) })}
            className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          />
        </Field>
      </Section>

      {/* ---- Trial ---- */}
      <Section icon={Gift} title="التجربة المجانية" accent="purple" desc="تجربة لمرة واحدة لكل مستخدم">
        <Toggle
          label="تفعيل التجربة"
          checked={s.trial.enabled}
          onChange={(v) => setS({ ...s, trial: { ...s.trial, enabled: v } })}
        />
        {s.trial.enabled && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="مدة التجربة (أيام)">
              <input
                type="number"
                min={1}
                value={s.trial.durationDays}
                onChange={(e) => setS({ ...s, trial: { ...s.trial, durationDays: Number(e.target.value) } })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
              />
            </Field>
            <Field label="تقييد التجربة لباقة محددة" hint="فارغ = المستخدم يختار">
              <select
                value={s.trial.allowedTier}
                onChange={(e) => setS({ ...s, trial: { ...s.trial, allowedTier: e.target.value } })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
              >
                <option value="">المستخدم يختار</option>
                <option value="BASIC">أساسي فقط</option>
                <option value="GOLD">ذهبي فقط</option>
                <option value="PLATINUM">بلاتيني فقط</option>
              </select>
            </Field>
          </div>
        )}
      </Section>

      {/* ---- COD & contact ---- */}
      <Section icon={Truck} title="المتجر والتواصل">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="رسوم الدفع عند الاستلام (ر.ع)">
            <input
              type="number"
              min={0}
              step="0.1"
              value={s.codFeeOmr}
              onChange={(e) => setS({ ...s, codFeeOmr: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
            />
          </Field>
          <Field label="إيميل الدعم">
            <input
              type="email"
              dir="ltr"
              value={s.supportEmail}
              onChange={(e) => setS({ ...s, supportEmail: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
            />
          </Field>
          <Field label="واتساب الدعم (مع رمز الاتصال)">
            <input
              type="tel"
              dir="ltr"
              placeholder="+96812345678"
              value={s.supportWhatsapp}
              onChange={(e) => setS({ ...s, supportWhatsapp: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
            />
          </Field>
        </div>
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-30 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A6B] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#132a4d] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الإعدادات
        </button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, desc, accent = 'slate', children }) {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1B3A6B]">{title}</h2>
          {desc && <p className="text-xs text-gray-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-[#C9A84C]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? 'right-0.5' : 'right-[calc(100%-1.375rem)]'
          }`}
        />
      </button>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
    </label>
  )
}
