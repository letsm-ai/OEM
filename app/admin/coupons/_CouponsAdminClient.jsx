'use client'

import { useEffect, useState } from 'react'
import { Tag, Plus, Trash2, Power, Loader2, X, Percent, DollarSign } from 'lucide-react'

export default function CouponsAdminClient() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    code: '',
    description: '',
    type: 'PERCENT',
    value: 10,
    minSubtotal: 0,
    maxDiscount: 0,
    expiresAt: '',
    usageLimit: 0,
    perUserLimit: 1,
    active: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/coupons')
      const d = await r.json()
      setList(d.coupons || [])
    } catch (e) { setList([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setMsg('')
    try {
      const r = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'تعذّر الحفظ')
      } else {
        setMsg('تم إنشاء الكوبون بنجاح ✔')
        setShowForm(false)
        setForm({ code: '', description: '', type: 'PERCENT', value: 10, minSubtotal: 0, maxDiscount: 0, expiresAt: '', usageLimit: 0, perUserLimit: 1, active: true })
        await load()
      }
    } catch (e) { setError('تعذّر الاتصال') }
    finally { setSaving(false) }
  }

  const toggleActive = async (c) => {
    await fetch(`/api/admin/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    await load()
  }
  const remove = async (c) => {
    if (!confirm(`حذف الكوبون ${c.code}؟`)) return
    const r = await fetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' })
    const d = await r.json()
    if (!r.ok) { alert(d.error || 'تعذّر الحذف'); return }
    await load()
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-[#C9A84C]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#1B3A6B]">كوبونات الخصم</h1>
              <p className="text-sm text-gray-500">إدارة رموز الخصم الخاصة بمتجر المجلس</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152c52]"
          >
            {showForm ? <><X className="h-4 w-4" /> إلغاء</> : <><Plus className="h-4 w-4" /> كوبون جديد</>}
          </button>
        </div>

        {msg && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
            {msg}
          </div>
        )}

        {showForm && (
          <form onSubmit={create} className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="الرمز *" dir="ltr">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" className="inp" required />
            </Field>
            <Field label="الوصف">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="عرض ترحيبي" className="inp" />
            </Field>
            <Field label="نوع الخصم">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="inp">
                <option value="PERCENT">نسبة مئوية %</option>
                <option value="FIXED">مبلغ ثابت ر.ع</option>
              </select>
            </Field>
            <Field label={form.type === 'PERCENT' ? 'النسبة %' : 'المبلغ (ر.ع)'}>
              <input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="inp" required />
            </Field>
            <Field label="الحد الأدنى للسلة (ر.ع)">
              <input type="number" step="0.01" min="0" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: Number(e.target.value) })} className="inp" />
            </Field>
            {form.type === 'PERCENT' && (
              <Field label="أقصى خصم (ر.ع) — 0 = بدون حد">
                <input type="number" step="0.01" min="0" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} className="inp" />
              </Field>
            )}
            <Field label="تاريخ الانتهاء">
              <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="inp" />
            </Field>
            <Field label="الحد الأقصى للاستخدام — 0 = بدون حد">
              <input type="number" min="0" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} className="inp" />
            </Field>
            <Field label="حد الاستخدام لكل مستخدم">
              <input type="number" min="0" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} className="inp" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-2 pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> مفعّل
              </label>
              {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
              <button type="submit" disabled={saving} className="rounded-xl bg-[#C9A84C] px-5 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50">
                {saving ? 'جارٍ الحفظ...' : 'حفظ الكوبون'}
              </button>
            </div>
            <style jsx>{`
              .inp { width: 100%; border-radius: 0.5rem; border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; background: white; }
              .inp:focus { border-color: #1B3A6B; }
            `}</style>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
            لا توجد كوبونات بعد — أنشئ أول كوبون خصم الآن.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="p-3 text-right">الرمز</th>
                  <th className="p-3 text-right">الخصم</th>
                  <th className="p-3 text-right">أدنى سلة</th>
                  <th className="p-3 text-right">الاستخدام</th>
                  <th className="p-3 text-right">ينتهي</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3">
                      <div className="font-bold text-[#1B3A6B]" dir="ltr">{c.code}</div>
                      {c.description && <div className="text-[11px] text-gray-500">{c.description}</div>}
                    </td>
                    <td className="p-3">
                      {c.type === 'PERCENT' ? (
                        <span className="inline-flex items-center gap-1 font-semibold"><Percent className="h-3 w-3" />{c.value}%</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold">{c.value} ر.ع</span>
                      )}
                      {c.maxDiscount > 0 && c.type === 'PERCENT' && (
                        <div className="text-[10px] text-gray-500">بحد أقصى {c.maxDiscount} ر.ع</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{c.minSubtotal > 0 ? `${c.minSubtotal} ر.ع` : '—'}</td>
                    <td className="p-3 text-gray-600">
                      {c.usedCount}{c.usageLimit > 0 ? ` / ${c.usageLimit}` : ''}
                    </td>
                    <td className="p-3 text-gray-600">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('ar-OM') : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {c.active ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleActive(c)}
                          title={c.active ? 'تعطيل' : 'تفعيل'}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(c)}
                          disabled={c.usedCount > 0}
                          title={c.usedCount > 0 ? 'لا يمكن حذف كوبون تم استخدامه' : 'حذف'}
                          className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:border-red-300 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, dir, children }) {
  return (
    <label className="block" dir={dir}>
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}
