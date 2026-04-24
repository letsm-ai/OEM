'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Package,
  ShoppingCart,
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Power,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Truck,
  Store,
  X,
  Upload,
  ImageIcon,
  Settings as SettingsIcon,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  BarChart3,
  Tag,
  Warehouse,
  History,
  AlertTriangle,
  Minus,
} from 'lucide-react'
import {
  PRODUCT_CATEGORIES,
  SUBCATEGORIES,
  formatOMR,
  categoryLabel,
  categoryEmoji,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE,
  COMMISSION_PERCENT,
} from '@/lib/store'

export default function VendorDashboardClient() {
  const [tab, setTab] = useState('analytics')
  return (
    <div className="bg-[#F8F9FA] py-6">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center gap-2">
          <Store className="h-6 w-6 text-[#1B3A6B]" />
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">لوحة البائع</h1>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm overflow-x-auto">
          <TabBtn active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={<BarChart3 className="h-4 w-4" />} label="التحليلات" />
          <TabBtn active={tab === 'products'} onClick={() => setTab('products')} icon={<Package className="h-4 w-4" />} label="منتجاتي" />
          <TabBtn active={tab === 'inventory'} onClick={() => setTab('inventory')} icon={<Warehouse className="h-4 w-4" />} label="المخزون" />
          <TabBtn active={tab === 'promotions'} onClick={() => setTab('promotions')} icon={<Tag className="h-4 w-4" />} label="العروض" />
          <TabBtn active={tab === 'payouts'} onClick={() => setTab('payouts')} icon={<Wallet className="h-4 w-4" />} label="السحب" />
          <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingCart className="h-4 w-4" />} label="الطلبات" />
          <TabBtn active={tab === 'earnings'} onClick={() => setTab('earnings')} icon={<Wallet className="h-4 w-4" />} label="الأرباح" />
          <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon={<SettingsIcon className="h-4 w-4" />} label="بروفايل المتجر" />
        </div>

        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'products' && <ProductsTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'promotions' && <PromotionsTab />}
        {tab === 'payouts' && <PayoutsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'earnings' && <EarningsTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-[#1B3A6B] text-white shadow' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/* --------------- PAYOUTS (vendor) --------------- */
function PayoutsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/vendor/payouts')
      const d = await r.json()
      if (r.ok) setData(d)
      else setError(d?.error || 'خطأ')
    } catch (e) {
      setError('تعذّر الاتصال')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="inline-block h-4 w-4" /> {error}</div>
  if (!data) return null

  const b = data.balance
  const canRequest = b.availableBalance >= b.minPayoutAmount

  const statusLabels = {
    PENDING: { label:'قيد المراجعة', color:'bg-amber-100 text-amber-800' },
    APPROVED: { label:'موافق عليه', color:'bg-blue-100 text-blue-800' },
    PAID: { label:'تم التحويل', color:'bg-green-100 text-green-800' },
    REJECTED: { label:'مرفوض', color:'bg-red-100 text-red-800' },
  }

  return (
    <div className="space-y-4">
      {/* Balance overview */}
      <div className="rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-5 text-white shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-80">الرصيد المتاح للسحب</div>
            <div className="mt-1 text-4xl font-extrabold">{formatOMR(b.availableBalance)} <span className="text-lg opacity-80">ر.ع</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] opacity-90">
              <div>إيراد الطلبات المكتملة: <b>{formatOMR(b.eligibleRevenue)}</b></div>
              <div>العمولة ({b.commissionPercent}%): <b>-{formatOMR(b.commission)}</b></div>
              <div>قيد الانتظار: <b>{formatOMR(b.pendingOut)}</b></div>
              <div>تم تحويله سابقاً: <b>{formatOMR(b.committedOut)}</b></div>
            </div>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            disabled={!canRequest}
            className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-extrabold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            طلب سحب
          </button>
        </div>
        {!canRequest && (
          <div className="mt-2 rounded-md bg-white/10 px-2 py-1 text-[11px]">
            الحد الأدنى للسحب: {b.minPayoutAmount} ر.ع. {b.deliveredOrderCount === 0 ? 'لا توجد طلبات مكتملة بعد.' : ''}
          </div>
        )}
      </div>

      {/* Requests history */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-[#1B3A6B]">طلبات السحب السابقة</h3>
        {data.requests.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">لم تقدّم أي طلب سحب بعد</div>
        ) : (
          <div className="space-y-2">
            {data.requests.map((r) => {
              const s = statusLabels[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.color}`}>{s.label}</span>
                      <span className="text-lg font-extrabold text-[#1B3A6B]">{formatOMR(r.amountRequested)} ر.ع</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {r.bankDetails?.bankName} · IBAN: <span dir="ltr">{r.bankDetails?.iban}</span>
                    </div>
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <div className="mt-1 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-800">
                        سبب الرفض: {r.rejectionReason}
                      </div>
                    )}
                    {r.status === 'PAID' && r.transferReference && (
                      <div className="mt-1 rounded-md bg-green-50 px-2 py-1 text-[11px] text-green-800">
                        مرجع التحويل: <span dir="ltr" className="font-bold">{r.transferReference}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-end text-[10px] text-gray-400">
                    طُلب: {new Date(r.requestedAt).toLocaleDateString('ar-OM')}
                    {r.processedAt && <div>معالَج: {new Date(r.processedAt).toLocaleDateString('ar-OM')}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {requestOpen && (
        <PayoutRequestModal
          balance={b}
          onClose={() => setRequestOpen(false)}
          onDone={() => { setRequestOpen(false); load() }}
        />
      )}
    </div>
  )
}

function PayoutRequestModal({ balance, onClose, onDone }) {
  const [form, setForm] = useState({
    amount: balance.availableBalance,
    accountHolderName: '',
    bankName: '',
    iban: '',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/vendor/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(form.amount),
        bankDetails: {
          accountHolderName: form.accountHolderName.trim(),
          bankName: form.bankName.trim(),
          iban: form.iban.replace(/\s+/g, '').toUpperCase(),
          note: form.note,
        },
      }),
    })
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(d?.error || 'خطأ')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1B3A6B]">طلب سحب رصيد</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-[11px] text-gray-500">الرصيد المتاح</div>
          <div className="text-xl font-extrabold text-[#1B3A6B]">{formatOMR(balance.availableBalance)} ر.ع</div>
          <div className="text-[10px] text-gray-500">الحد الأدنى: {balance.minPayoutAmount} ر.ع</div>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-semibold">المبلغ المطلوب (ر.ع) *</label>
            <input required type="number" step="0.01" min={balance.minPayoutAmount} max={balance.availableBalance}
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">اسم صاحب الحساب *</label>
            <input required value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">اسم البنك *</label>
            <input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="مثال: بنك مسقط، البنك الوطني العماني"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">رقم IBAN * <span className="text-[10px] text-gray-400">(يبدأ بـ OM، 22 خانة)</span></label>
            <input required dir="ltr" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
              placeholder="OMxx xxxx xxxx xxxx xxxx xx"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#1B3A6B]" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold">ملاحظة (اختياري)</label>
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 300) })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertCircle className="inline-block h-3.5 w-3.5" /> {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50">إلغاء</button>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} إرسال الطلب
          </button>
        </div>
      </form>
    </div>
  )
}

/* --------------- PROMOTIONS (vendor) --------------- */
function PromotionsTab() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // object or null

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/promotions')
    const d = await r.json()
    setPromos(d.promotions || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const onDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا العرض؟')) return
    await fetch(`/api/vendor/promotions/${id}`, { method: 'DELETE' })
    load()
  }
  const onToggle = async (p) => {
    await fetch(`/api/vendor/promotions/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">{promos.length} عرض</div>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
        >
          <Plus className="h-4 w-4" /> إضافة عرض
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
        </div>
      ) : promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          🎁 لا توجد عروض ترويجية. أنشئ عرضاً لجذب المزيد من المبيعات.
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <PromotionCard
              key={p.id}
              promo={p}
              onEdit={() => setEditing(p)}
              onDelete={() => onDelete(p.id)}
              onToggle={() => onToggle(p)}
            />
          ))}
        </div>
      )}
      {editing !== null && (
        <PromotionFormModal
          promo={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function PromotionCard({ promo, onEdit, onDelete, onToggle }) {
  const now = new Date()
  const ended = promo.endDate && new Date(promo.endDate) < now
  const future = promo.startDate && new Date(promo.startDate) > now
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${promo.isActive && !ended ? 'border-green-200' : 'border-gray-200 opacity-80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1B3A6B] px-2 py-0.5 text-[10px] font-bold text-white">
              {promo.type === 'BUY_X_GET_Y' ? '🎁 اشتر X احصل على Y' : '📊 خصم تدريجي'}
            </span>
            {!promo.isActive && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">معطّل</span>}
            {ended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">انتهى</span>}
            {future && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">لم يبدأ</span>}
          </div>
          <div className="mt-1.5 text-sm font-bold text-[#1B3A6B]">{promo.nameAr}</div>
          {promo.descriptionAr && (
            <div className="mt-0.5 text-[11px] text-gray-500">{promo.descriptionAr}</div>
          )}
          <div className="mt-2 text-xs text-gray-700">
            {promo.type === 'BUY_X_GET_Y' ? (
              <>اشتر <b>{promo.buyQty}</b> احصل على <b>{promo.getQty}</b> بخصم <b>{promo.getDiscountPercent}%</b></>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(promo.tiers || []).map((t, i) => (
                  <span key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px]">
                    ≥ {t.minSpend} ر.ع → <b className="text-[#C9A84C]">{t.percent}%</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">
            المنتجات: {promo.productIds?.length > 0 ? `${promo.productIds.length} منتج محدّد` : 'كل منتجاتي'}
            {promo.endDate && ` · ينتهي ${new Date(promo.endDate).toLocaleDateString('ar-OM')}`}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col gap-1">
          <button
            onClick={onToggle}
            className={`rounded-md p-1.5 ${promo.isActive ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
            title={promo.isActive ? 'تعطيل' : 'تفعيل'}
          >
            <Power className="h-4 w-4" />
          </button>
          <button onClick={onEdit} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50" title="تعديل">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="حذف">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function PromotionFormModal({ promo, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: promo?.type || 'BUY_X_GET_Y',
    nameAr: promo?.nameAr || '',
    descriptionAr: promo?.descriptionAr || '',
    isActive: promo?.isActive !== false,
    buyQty: promo?.buyQty || 2,
    getQty: promo?.getQty || 1,
    getDiscountPercent: promo?.getDiscountPercent || 100,
    tiers: promo?.tiers?.length ? promo.tiers : [{ minSpend: 30, percent: 10 }],
    endDate: promo?.endDate ? new Date(promo.endDate).toISOString().split('T')[0] : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nameAr.trim()) return setError('اسم العرض مطلوب')
    setLoading(true)
    const payload = {
      type: form.type,
      nameAr: form.nameAr.trim(),
      descriptionAr: form.descriptionAr,
      isActive: form.isActive,
      endDate: form.endDate || null,
    }
    if (form.type === 'BUY_X_GET_Y') {
      payload.buyQty = parseInt(form.buyQty, 10) || 2
      payload.getQty = parseInt(form.getQty, 10) || 1
      payload.getDiscountPercent = parseInt(form.getDiscountPercent, 10) || 100
    } else {
      payload.tiers = form.tiers.filter((t) => t.minSpend >= 0 && t.percent >= 1)
    }
    const res = await fetch(
      promo ? `/api/vendor/promotions/${promo.id}` : '/api/vendor/promotions',
      {
        method: promo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(d.error || 'خطأ')
    onSaved()
  }

  const addTier = () => setForm((f) => ({ ...f, tiers: [...f.tiers, { minSpend: 0, percent: 10 }] }))
  const updTier = (i, k, v) => setForm((f) => ({ ...f, tiers: f.tiers.map((t, j) => j === i ? { ...t, [k]: v } : t) }))
  const rmTier = (i) => setForm((f) => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-10 w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1B3A6B]">
            {promo ? 'تعديل العرض' : 'إضافة عرض جديد'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'BUY_X_GET_Y' })}
            className={`rounded-lg border-2 p-3 text-xs font-bold transition ${form.type === 'BUY_X_GET_Y' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#1B3A6B]' : 'border-gray-200 bg-white text-gray-600'}`}
          >
            🎁 اشتر X احصل على Y
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'TIER' })}
            className={`rounded-lg border-2 p-3 text-xs font-bold transition ${form.type === 'TIER' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#1B3A6B]' : 'border-gray-200 bg-white text-gray-600'}`}
          >
            📊 خصم تدريجي
          </button>
        </div>

        <div className="mb-3 grid gap-2">
          <label className="text-xs font-semibold">اسم العرض *</label>
          <input
            required
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            placeholder="مثال: اشتر 2 احصل على 1 مجاناً"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          />
        </div>
        <div className="mb-3 grid gap-2">
          <label className="text-xs font-semibold">وصف العرض (اختياري)</label>
          <textarea
            rows={2}
            value={form.descriptionAr}
            onChange={(e) => setForm({ ...form, descriptionAr: e.target.value.slice(0, 500) })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          />
        </div>

        {form.type === 'BUY_X_GET_Y' && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="grid gap-1">
              <label className="text-[11px] font-semibold">اشتر</label>
              <input type="number" min="1" value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] font-semibold">احصل على</label>
              <input type="number" min="1" value={form.getQty} onChange={(e) => setForm({ ...form, getQty: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] font-semibold">بخصم %</label>
              <input type="number" min="1" max="100" value={form.getDiscountPercent} onChange={(e) => setForm({ ...form, getDiscountPercent: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]" />
            </div>
            <div className="col-span-3 text-[11px] text-gray-500">
              مثال: اشتر {form.buyQty} احصل على {form.getQty} بخصم {form.getDiscountPercent}% {form.getDiscountPercent === 100 ? '(مجاناً)' : ''}
            </div>
          </div>
        )}

        {form.type === 'TIER' && (
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold">مستويات الخصم</label>
              <button type="button" onClick={addTier} className="text-[11px] font-bold text-[#1B3A6B] hover:underline">+ إضافة مستوى</button>
            </div>
            <div className="space-y-2">
              {form.tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <span className="text-xs text-gray-500">إذا اشترى بـ ≥</span>
                  <input type="number" step="0.5" min="0" value={t.minSpend} onChange={(e) => updTier(i, 'minSpend', Number(e.target.value))} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                  <span className="text-xs text-gray-500">ر.ع → خصم</span>
                  <input type="number" min="1" max="90" value={t.percent} onChange={(e) => updTier(i, 'percent', Number(e.target.value))} className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                  <span className="text-xs text-gray-500">%</span>
                  <button type="button" onClick={() => rmTier(i)} className="ms-auto text-red-500 hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-semibold">تاريخ انتهاء (اختياري)</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-[#C9A84C]" />
            نشط
          </label>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertCircle className="inline-block h-3.5 w-3.5" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
            إلغاء
          </button>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
          </button>
        </div>
      </form>
    </div>
  )
}

/* --------------- INVENTORY (vendor) --------------- */
function InventoryTab() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, lowCount: 0 })
  const [loading, setLoading] = useState(true)
  const [onlyLow, setOnlyLow] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState(null) // { productId, productName, variantId?, variantName?, currentStock }
  const [historyTarget, setHistoryTarget] = useState(null) // productId to show history

  const load = async (low = onlyLow) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor/inventory${low ? '?lowStock=1' : ''}`)
      const d = await res.json()
      if (res.ok) {
        setItems(d.products || [])
        setSummary(d.summary || { total: 0, active: 0, lowCount: 0 })
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(onlyLow) }, [onlyLow])

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500">إجمالي المنتجات</div>
          <div className="text-xl font-extrabold text-[#1B3A6B]">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500">منتجات نشطة</div>
          <div className="text-xl font-extrabold text-green-700">{summary.active}</div>
        </div>
        <div className={`rounded-xl border p-3 ${summary.lowCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
          <div className="text-[11px] text-gray-500">منتجات انخفاض مخزون</div>
          <div className={`text-xl font-extrabold ${summary.lowCount > 0 ? 'text-amber-800' : 'text-gray-700'}`}>
            {summary.lowCount}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
            className="h-4 w-4 accent-[#C9A84C]"
          />
          <span className="font-semibold text-gray-700">عرض المنتجات المنخفضة فقط</span>
        </label>
        <button
          onClick={() => load(onlyLow)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
        >
          تحديث
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          {onlyLow ? 'لا توجد منتجات منخفضة المخزون 🎉' : 'لا توجد منتجات بعد'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <InventoryCard
              key={p.id}
              product={p}
              onAdjust={(variant) => setAdjustTarget({
                productId: p.id,
                productName: p.nameAr,
                variantId: variant?.id || '',
                variantName: variant?.name || '',
                currentStock: variant ? variant.stock : p.stock,
              })}
              onHistory={() => setHistoryTarget(p.id)}
            />
          ))}
        </div>
      )}

      {adjustTarget && (
        <AdjustStockModal
          target={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { setAdjustTarget(null); load(onlyLow) }}
        />
      )}
      {historyTarget && (
        <StockHistoryModal
          productId={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}

function InventoryCard({ product, onAdjust, onHistory }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${product.isLow ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">📦</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-bold text-[#1B3A6B]">{product.nameAr}</div>
              {product.isLow && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <AlertTriangle className="h-3 w-3" /> منخفض
                </span>
              )}
              {!product.isActive && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">متوقّف</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              السعر: {formatOMR(product.price)} ر.ع · الحد الأدنى: {product.lowStockThreshold}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <div className={`text-2xl font-extrabold ${product.isLow ? 'text-amber-700' : 'text-[#1B3A6B]'}`}>
            {product.stock}
          </div>
          <div className="text-[10px] text-gray-400">قطعة</div>
        </div>
      </div>

      {product.hasVariants && product.variants?.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2">
          <div className="text-[11px] font-bold text-gray-600">الخيارات:</div>
          {product.variants.map((v) => {
            const isLow = v.stock <= product.lowStockThreshold
            return (
              <div
                key={v.id}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${isLow ? 'bg-amber-50' : 'bg-white'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">{v.name}</span>
                    {v.sku && <span dir="ltr" className="text-[10px] text-gray-400">SKU: {v.sku}</span>}
                    {isLow && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">منخفض</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-extrabold ${isLow ? 'text-amber-700' : 'text-[#1B3A6B]'}`}>{v.stock}</div>
                  <button
                    onClick={() => onAdjust(v)}
                    className="rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-semibold hover:bg-gray-50"
                  >
                    تعديل
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!product.hasVariants && (
          <button
            onClick={() => onAdjust(null)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-bold text-[#1B3A6B] hover:bg-[#b89440]"
          >
            <Edit2 className="h-3.5 w-3.5" /> تعديل المخزون
          </button>
        )}
        <button
          onClick={onHistory}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
        >
          <History className="h-3.5 w-3.5" /> سجل الحركات
        </button>
      </div>
    </div>
  )
}

function AdjustStockModal({ target, onClose, onSaved }) {
  const [type, setType] = useState('RESTOCK')
  const [delta, setDelta] = useState(1)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const newStock = Math.max(0, (target.currentStock || 0) + Number(delta || 0))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!Number.isFinite(Number(delta)) || Number(delta) === 0) {
      return setError('قيمة التعديل لا يمكن أن تكون صفراً')
    }
    setLoading(true)
    const res = await fetch(`/api/products/${target.productId}/stock/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta: Number(delta),
        type,
        note,
        variantId: target.variantId || undefined,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(d.error || 'خطأ')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1B3A6B]">تعديل المخزون</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-xs font-bold text-gray-800">{target.productName}</div>
          {target.variantName && (
            <div className="text-[11px] text-gray-600">الخيار: {target.variantName}</div>
          )}
          <div className="mt-1 text-[11px] text-gray-500">
            المخزون الحالي: <b className="text-[#1B3A6B]">{target.currentStock}</b> قطعة
          </div>
        </div>
        <div className="mb-3 grid gap-2">
          <label className="text-xs font-semibold text-gray-700">نوع الحركة</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          >
            <option value="RESTOCK">🔼 شحنة جديدة (RESTOCK)</option>
            <option value="ADJUST">⚙️ تعديل يدوي (ADJUST)</option>
            <option value="RETURN">↩️ إرجاع (RETURN)</option>
          </select>
        </div>
        <div className="mb-3 grid gap-2">
          <label className="text-xs font-semibold text-gray-700">
            قيمة التعديل <span className="text-[10px] text-gray-400">(موجب = زيادة، سالب = نقصان)</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDelta((d) => Number(d) - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-bold outline-none focus:border-[#1B3A6B]"
            />
            <button
              type="button"
              onClick={() => setDelta((d) => Number(d) + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="text-[11px] text-gray-500">
            المخزون الجديد: <b className="text-[#1B3A6B]">{newStock}</b> قطعة
          </div>
        </div>
        <div className="mb-3 grid gap-2">
          <label className="text-xs font-semibold text-gray-700">ملاحظة (اختياري)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={2}
            maxLength={300}
            placeholder="مثال: شحنة جديدة من المورد، أو تالف بسبب الرطوبة..."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          />
        </div>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertCircle className="inline-block h-3.5 w-3.5" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-1.5 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ
          </button>
        </div>
      </form>
    </div>
  )
}

function StockHistoryModal({ productId, onClose }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/products/${productId}/stock/movements`)
      const d = await res.json()
      setMovements(d?.movements || [])
      setLoading(false)
    })()
  }, [productId])

  const typeLabels = {
    INIT: { label: 'إنشاء', color: 'text-blue-700 bg-blue-50' },
    RESTOCK: { label: 'شحنة', color: 'text-green-700 bg-green-50' },
    SALE: { label: 'بيع', color: 'text-purple-700 bg-purple-50' },
    ADJUST: { label: 'تعديل', color: 'text-amber-700 bg-amber-50' },
    RETURN: { label: 'إرجاع', color: 'text-teal-700 bg-teal-50' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1B3A6B]">سجل حركات المخزون</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
          </div>
        ) : movements.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">لا توجد حركات بعد</div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {movements.map((m) => {
              const info = typeLabels[m.type] || { label: m.type, color: 'text-gray-700 bg-gray-100' }
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5">
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.color}`}>
                    {info.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    {m.variantName && <div className="text-[11px] text-gray-500">{m.variantName}</div>}
                    <div className="text-xs text-gray-700">
                      {m.qtyBefore} → <b className="text-[#1B3A6B]">{m.qtyAfter}</b>
                      <span className={`ms-1 font-bold ${m.qtyDelta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ({m.qtyDelta >= 0 ? '+' : ''}{m.qtyDelta})
                      </span>
                    </div>
                    {m.note && <div className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">{m.note}</div>}
                  </div>
                  <div className="flex-shrink-0 text-end text-[10px] text-gray-400">
                    {new Date(m.createdAt).toLocaleString('ar-OM', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {m.createdByName && <div className="mt-0.5">{m.createdByName}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------- ANALYTICS (vendor) --------------- */
function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/vendor/analytics')
        const d = await res.json()
        if (!res.ok) {
          setError(d?.error || 'تعذّر تحميل التحليلات')
        } else {
          setData(d)
        }
      } catch (e) {
        setError('تعذّر الاتصال')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
    </div>
  )
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="inline-block h-4 w-4" /> {error}
    </div>
  )
  if (!data) return null

  const monthLabels = data.monthly.map((m) => {
    const names = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    return { ...m, label: names[m.month - 1] }
  })

  const statusColors = {
    PENDING:'#9CA3AF', PAID:'#3B82F6', SHIPPED:'#F59E0B',
    DELIVERED:'#10B981', CANCELLED:'#EF4444', FAILED:'#DC2626',
  }
  const statusArabic = {
    PENDING:'قيد الانتظار', PAID:'مدفوع', SHIPPED:'تم الشحن',
    DELIVERED:'تم التسليم', CANCELLED:'ملغي', FAILED:'فاشل',
  }

  return (
    <AnalyticsBody data={data} monthLabels={monthLabels} statusColors={statusColors} statusArabic={statusArabic} />
  )
}

function AnalyticsBody({ data, monthLabels, statusColors, statusArabic }) {
  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الإيرادات"
          value={`${formatOMR(data.kpi.totalRevenue)} ر.ع`}
          color="from-[#1B3A6B] to-[#152c52]"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="صافي الأرباح (بعد العمولة)"
          value={`${formatOMR(data.kpi.totalNet)} ر.ع`}
          color="from-green-600 to-green-800"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="إجمالي الطلبات"
          value={String(data.kpi.totalOrders)}
          color="from-[#C9A84C] to-[#a8892f]"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          label="متوسط قيمة الطلب"
          value={`${formatOMR(data.kpi.avgOrderValue)} ر.ع`}
          color="from-purple-600 to-purple-800"
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard label="آخر 30 يوماً" value={`${formatOMR(data.last30Days.revenue)} ر.ع`} sub={`${data.last30Days.orders} طلب`} />
        <MiniCard label="إجمالي القطع المباعة" value={String(data.kpi.totalUnits)} sub="قطعة" />
        <MiniCard label="منتجات نشطة" value={`${data.products.active}/${data.products.total}`} sub={data.products.lowStock > 0 ? `${data.products.lowStock} انخفاض مخزون` : 'كل المخزون مستقر'} warn={data.products.lowStock > 0} />
        <MiniCard label="طلبات بانتظار الشحن" value={String(data.pendingShipments)} sub="PAID لم تُشحن" warn={data.pendingShipments > 0} />
      </div>

      {/* Revenue + orders time series (AreaChart) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-bold text-[#1B3A6B]">الإيرادات الشهرية</h3>
        <RevenueChart data={monthLabels} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-[#1B3A6B]">أفضل المنتجات</h3>
          {data.topProducts.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">لا توجد مبيعات بعد</div>
          ) : (
            <ul className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A84C] text-xs font-extrabold text-[#1B3A6B]">{i + 1}</span>
                    <span className="truncate text-sm font-semibold text-gray-800">{p.nameAr}</span>
                  </div>
                  <div className="flex-shrink-0 text-end">
                    <div className="text-sm font-extrabold text-[#1B3A6B]">{formatOMR(p.revenue)} ر.ع</div>
                    <div className="text-[10px] text-gray-500">{p.units} قطعة</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Order status breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-bold text-[#1B3A6B]">توزيع حالات الطلبات</h3>
          {data.orderStatus.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">لا توجد طلبات بعد</div>
          ) : (
            <div className="space-y-2">
              {data.orderStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-semibold" style={{ color: statusColors[s.status] || '#6B7280' }}>
                    {statusArabic[s.status] || s.status}
                  </div>
                  <div className="flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (s.count / Math.max(...data.orderStatus.map(x => x.count), 1)) * 100)}%`,
                        backgroundColor: statusColors[s.status] || '#6B7280',
                      }}
                    />
                  </div>
                  <div className="w-10 text-end text-sm font-bold text-gray-800">{s.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By Category */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-bold text-[#1B3A6B]">الإيرادات حسب الفئة</h3>
        {data.byCategory.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">لا توجد بيانات</div>
        ) : (
          <CategoryChart data={data.byCategory} />
        )}
      </div>

      <div className="text-center text-[11px] text-gray-400">
        تم التحديث: {new Date(data.generatedAt).toLocaleString('ar-OM')}
      </div>
    </div>
  )
}

function MiniCard({ label, value, sub, warn }) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${warn ? 'text-amber-800' : 'text-[#1B3A6B]'}`}>{value}</div>
      <div className={`mt-0.5 text-[10px] ${warn ? 'text-amber-700' : 'text-gray-400'}`}>{sub}</div>
    </div>
  )
}

function RevenueChart({ data }) {
  return (
    <div style={{ width: '100%', height: 260, direction: 'ltr' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, name) => name === 'revenue' ? [`${v} ر.ع`, 'الإيراد'] : [v, 'الطلبات']}
            contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#C9A84C" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CategoryChart({ data }) {
  const catAr = { FOOD:'غذائية', FASHION:'ملابس', ELECTRONICS:'إلكترونيات', OFFICE:'مكتبية', HANDICRAFT:'يدوية', DIGITAL:'رقمية', OTHER:'أخرى' }
  const rows = data.map((x) => ({ ...x, label: catAr[x.category] || x.category }))
  return (
    <div style={{ width: '100%', height: 240, direction: 'ltr' }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v} ر.ع`, 'الإيراد']}
            contentStyle={{ direction: 'rtl', fontFamily: 'Cairo' }}
          />
          <Bar dataKey="revenue" fill="#1B3A6B" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --------------- PRODUCTS --------------- */
function ProductsTab() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/products')
    const d = await r.json()
    setProducts(d.products || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const onDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    load()
  }
  const onToggleActive = async (p) => {
    await fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-gray-500">{products.length} منتج</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-3 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white transition"
          >
            <Upload className="h-4 w-4" /> استيراد CSV
          </button>
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
          >
            <Plus className="h-4 w-4" /> إضافة منتج
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          لم تضف أي منتجات بعد، ابدأ بإضافة منتج.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">{categoryEmoji(p.category)}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <div className="line-clamp-1 text-sm font-bold text-[#1B3A6B]">{p.nameAr}</div>
                  {!p.isActive && (
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-700">مُعطّل</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">{categoryLabel(p.category)}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="font-extrabold text-[#1B3A6B]">{formatOMR(p.price)} ر.ع</span>
                  <span className="text-gray-400">•</span>
                  <span>المخزون: {p.stock}</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50"
                    title="تعديل"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onToggleActive(p)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50"
                    title={p.isActive ? 'تعطيل' : 'تفعيل'}
                  >
                    <Power className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                    title="حذف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductFormModal
          product={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
      {importOpen && (
        <CsvImportModal
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); load() }}
        />
      )}
    </div>
  )
}

function CsvImportModal({ onClose, onDone }) {
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'importing' | 'done'
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (e) => {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      const Papa = (await import('papaparse')).default
      const text = await file.text()
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (!res.data || res.data.length === 0) {
            setError('الملف فارغ أو صيغته غير صحيحة')
            return
          }
          if (res.data.length > 200) {
            setError('الحد الأقصى 200 منتج لكل ملف')
            return
          }
          setRows(res.data)
          setStep('preview')
        },
        error: (err) => setError('تعذّر قراءة الملف: ' + err.message),
      })
    } catch (e) {
      setError('تعذّر قراءة الملف: ' + e.message)
    }
  }

  const runImport = async () => {
    setLoading(true)
    setStep('importing')
    try {
      const r = await fetch('/api/vendor/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const d = await r.json()
      setResults(d)
      setStep('done')
    } catch (e) {
      setError('فشل الاستيراد: ' + e.message)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    window.open('/api/vendor/products/import/template', '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1B3A6B]">📤 استيراد منتجات بالجملة (CSV)</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">ارفع ملف CSV بمنتجاتك وأضفهم دفعة واحدة (حتى 200 منتج)</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-2 text-sm font-semibold text-gray-700">اختر ملف CSV لرفعه</p>
              <p className="mt-1 text-[11px] text-gray-500">الأعمدة المطلوبة: nameAr, price, stock, category</p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]">
                <Upload className="h-4 w-4" /> اختر ملف
                <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
              </label>
              {fileName && <p className="mt-2 text-xs text-gray-600">📄 {fileName}</p>}
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-blue-900">💡 لست متأكد من الصيغة؟</div>
                  <div className="mt-0.5 text-blue-700">حمّل القالب الجاهز وعبّئه بمنتجاتك</div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  📥 تنزيل القالب
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-bold text-gray-800">📋 الأعمدة المدعومة:</div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600">
                <div>• <b>nameAr</b> (مطلوب) — اسم المنتج بالعربي</div>
                <div>• <b>price</b> (مطلوب) — السعر بالريال العماني</div>
                <div>• <b>stock</b> (مطلوب) — الكمية في المخزون</div>
                <div>• <b>category</b> (مطلوب) — الفئة (FOOD/FASHION/…)</div>
                <div>• <b>nameEn</b> (اختياري) — الاسم الإنجليزي</div>
                <div>• <b>description</b> (اختياري) — الوصف</div>
                <div>• <b>lowStockThreshold</b> (اختياري) — حد التنبيه</div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                <AlertCircle className="inline-block h-3.5 w-3.5" /> {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">📋 معاينة — {rows.length} صف</div>
              <button onClick={() => { setStep('upload'); setRows([]); setFileName('') }} className="text-xs text-gray-500 hover:text-gray-700 underline">
                إلغاء واختيار ملف آخر
              </button>
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-2 text-start">#</th>
                    <th className="p-2 text-start">الاسم</th>
                    <th className="p-2 text-start">السعر</th>
                    <th className="p-2 text-start">المخزون</th>
                    <th className="p-2 text-start">الفئة</th>
                    <th className="p-2 text-start">حد التنبيه</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-2 text-gray-400">{i + 2}</td>
                      <td className="p-2 font-semibold text-gray-800 line-clamp-1">{r.nameAr || r.name_ar || r['اسم المنتج'] || '—'}</td>
                      <td className="p-2">{r.price || r['السعر'] || '—'}</td>
                      <td className="p-2">{r.stock || r['المخزون'] || '—'}</td>
                      <td className="p-2">{r.category || r['الفئة'] || 'OTHER'}</td>
                      <td className="p-2">{r.lowStockThreshold || r['حد التنبيه'] || 5}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div className="p-2 text-center text-[11px] text-gray-500 bg-gray-50">
                  +{rows.length - 50} صف إضافي لم يُعرض في المعاينة
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                إلغاء
              </button>
              <button
                onClick={runImport}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" /> استيراد الكل ({rows.length})
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#1B3A6B]" />
            <p className="mt-3 text-sm font-semibold text-gray-700">جاري استيراد المنتجات...</p>
          </div>
        )}

        {step === 'done' && results && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                <div className="text-[11px] text-gray-500">إجمالي الصفوف</div>
                <div className="text-2xl font-extrabold text-[#1B3A6B]">{results.total}</div>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
                <div className="text-[11px] text-green-700">تم إنشاؤه</div>
                <div className="text-2xl font-extrabold text-green-800">{results.createdCount}</div>
              </div>
              <div className={`rounded-xl border p-3 text-center ${results.failCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className={`text-[11px] ${results.failCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>فشل</div>
                <div className={`text-2xl font-extrabold ${results.failCount > 0 ? 'text-red-800' : 'text-gray-700'}`}>{results.failCount}</div>
              </div>
            </div>
            {results.failCount > 0 && (
              <div className="max-h-[30vh] overflow-auto rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="mb-1.5 text-xs font-bold text-red-900">الصفوف الفاشلة:</div>
                <ul className="space-y-1 text-[11px] text-red-800">
                  {results.results.filter((r) => !r.ok).map((r, i) => (
                    <li key={i}>• الصف {r.row}: {r.nameAr || '(بدون اسم)'} — {r.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onDone}
                className="rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-bold text-white hover:bg-[#152c52]"
              >
                تم ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    nameAr: product?.nameAr || '',
    nameEn: product?.nameEn || '',
    description: product?.description || '',
    price: product?.price ?? '',
    category: product?.category || 'OTHER',
    subcategory: product?.subcategory || '',
    stock: product?.stock ?? 0,
    lowStockThreshold: product?.lowStockThreshold ?? 5,
    tags: Array.isArray(product?.tags) ? [...product.tags] : [],
    images: product?.images || [],
    hasVariants: !!product?.hasVariants,
    variants: Array.isArray(product?.variants) ? product.variants : [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addVariant = () => {
    setForm((f) => ({
      ...f,
      hasVariants: true,
      variants: [
        ...(f.variants || []),
        { name: '', sku: '', price: f.price || 0, stock: 0, image: '', attrs: {} },
      ],
    }))
  }
  const updateVariant = (idx, patch) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }))
  }
  const removeVariant = (idx) => {
    setForm((f) => {
      const next = f.variants.filter((_, i) => i !== idx)
      return { ...f, variants: next, hasVariants: next.length > 0 }
    })
  }

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - form.images.length)
    const promises = files.map(
      (f) => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            const scale = Math.min(1, 800 / Math.max(img.width, img.height))
            const c = document.createElement('canvas')
            c.width = img.width * scale
            c.height = img.height * scale
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
            res(c.toDataURL('image/jpeg', 0.85))
          }
          img.onerror = rej
          img.src = reader.result
        }
        reader.onerror = rej
        reader.readAsDataURL(f)
      })
    )
    try {
      const urls = await Promise.all(promises)
      setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, 5) }))
    } catch {
      setError('تعذرت قراءة الصورة')
    }
    e.target.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nameAr.trim()) return setError('اسم المنتج مطلوب')
    const price = Number(form.price)
    if (!Number.isFinite(price) || price < 0) return setError('السعر غير صحيح')
    // Client-side variant validation
    if (form.hasVariants && form.variants.length > 0) {
      for (let i = 0; i < form.variants.length; i++) {
        const v = form.variants[i]
        if (!String(v.name || '').trim()) return setError(`اسم الخيار رقم ${i + 1} مطلوب`)
        const vp = Number(v.price)
        if (!Number.isFinite(vp) || vp < 0) return setError(`سعر الخيار "${v.name}" غير صحيح`)
      }
    }
    setLoading(true)
    const payload = {
      ...form,
      price,
      lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 0,
      tags: form.tags || [],
      variants: form.hasVariants ? form.variants.map((v) => ({
        id: v.id,
        name: String(v.name || '').trim(),
        sku: String(v.sku || '').trim(),
        price: Number(v.price) || 0,
        stock: parseInt(v.stock, 10) || 0,
        image: v.image || '',
        attrs: v.attrs || {},
      })) : [],
    }
    const res = await fetch(product ? `/api/products/${product.id}` : '/api/products', {
      method: product ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(data.error || 'خطأ')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-bold text-[#1B3A6B]">{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="الاسم (عربي) *">
              <input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" />
            </F>
            <F label="الاسم (إنجليزي)">
              <input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="input text-right" />
            </F>
            <F label="السعر (ر.ع) *">
              <input required type="number" step="0.001" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" />
            </F>
            <F label="الكمية في المخزون">
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" disabled={form.hasVariants} />
              {form.hasVariants && (
                <div className="mt-0.5 text-[10px] text-gray-500">يُحسب تلقائياً من مجموع خيارات المنتج</div>
              )}
            </F>
            <F label="حد التنبيه بانخفاض المخزون">
              <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="input" />
              <div className="mt-0.5 text-[10px] text-gray-500">سيظهر تنبيه عند وصول المخزون لهذا الرقم أو أقل</div>
            </F>
          </div>
          {/* Tags */}
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[#1B3A6B]">العلامات (Tags)</div>
                <div className="text-[11px] text-gray-500">
                  أضف كلمات مفتاحية (حتى 15) لتسهيل البحث. مثال: عضوي، هدية، صنع-يدوي
                </div>
              </div>
            </div>
            <TagsInput tags={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
          </div>

          <div className="hidden">{/* keep spacing */}</div>
            <F label="الفئة">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })} className="input">
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </F>
            <F label="التصنيف الفرعي">
              <select value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} className="input">
                <option value="">— لا شيء —</option>
                {(SUBCATEGORIES[form.category] || []).map((s) => (
                  <option key={s.key} value={s.key}>{s.labelAr}</option>
                ))}
              </select>
            </F>
          </div>
          <F label="الوصف">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-none" />
          </F>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-700">الصور ({form.images.length}/5)</div>
            <div className="grid grid-cols-5 gap-2">
              {form.images.map((img, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} className="absolute top-1 left-1 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {form.images.length < 5 && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#1B3A6B] hover:text-[#1B3A6B]">
                  <Upload className="h-5 w-5" />
                  <input type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
                </label>
              )}
            </div>
          </div>
          {/* Variants Editor (خيارات المنتج) */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[#1B3A6B]">خيارات المنتج (Variants)</div>
                <div className="text-[11px] text-gray-500">
                  أضف أحجام/ألوان/أنواع مع سعر ومخزون منفصلين لكل خيار (اختياري)
                </div>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-bold text-[#1B3A6B] hover:bg-[#b89440]"
              >
                <Plus className="h-3.5 w-3.5" /> إضافة خيار
              </button>
            </div>
            {form.hasVariants && form.variants.length > 0 ? (
              <div className="space-y-2">
                {form.variants.map((v, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-[1fr_1fr_90px_90px_32px]">
                    <input
                      placeholder="اسم الخيار (مثال: صغير / أحمر)"
                      value={v.name}
                      onChange={(e) => updateVariant(i, { name: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]"
                    />
                    <input
                      placeholder="SKU (اختياري)"
                      dir="ltr"
                      value={v.sku}
                      onChange={(e) => updateVariant(i, { sku: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]"
                    />
                    <input
                      type="number" step="0.001" min="0"
                      placeholder="السعر"
                      value={v.price}
                      onChange={(e) => updateVariant(i, { price: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]"
                    />
                    <input
                      type="number" min="0"
                      placeholder="المخزون"
                      value={v.stock}
                      onChange={(e) => updateVariant(i, { stock: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="flex items-center justify-center rounded-md p-1 text-red-500 hover:bg-red-50"
                      aria-label="حذف الخيار"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="text-[11px] text-gray-500">
                  ملاحظة: عند وجود خيارات، يصبح "الكمية في المخزون" مجموع مخزون الخيارات تلقائياً.
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-gray-500">
                لا توجد خيارات. اتركه فارغاً لمنتج بسيط بسعر واحد.
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">إلغاء</button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-bold text-white hover:bg-[#152c52] disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {product ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
        <style jsx>{`.input{width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:#1B3A6B;box-shadow:0 0 0 3px rgba(27,58,107,0.1)}`}</style>
      </div>
    </div>
  )
}
function F({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>{children}</label>
}

function TagsInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const add = (raw) => {
    const t = String(raw || '').trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-')
    if (!t || tags.includes(t) || tags.length >= 15) return
    onChange([...tags, t])
  }
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
      setInput('')
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white p-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-[11px] font-semibold text-[#1B3A6B]">
          #{t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-red-100 hover:text-red-600">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (input) { add(input); setInput('') } }}
        placeholder={tags.length >= 15 ? 'الحد الأقصى 15 علامة' : 'اكتب علامة واضغط Enter أو ،'}
        disabled={tags.length >= 15}
        className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-gray-400"
      />
    </div>
  )
}

/* --------------- ORDERS --------------- */
function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/orders')
    const d = await r.json()
    setOrders(d.orders || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id, status, extras = {}) => {
    const res = await fetch(`/api/vendor/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extras }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'تعذّر تحديث الحالة')
      return
    }
    load()
  }

  const handleShip = async (o) => {
    const trackingNumber = window.prompt('رقم التتبّع (اختياري):', '') || ''
    const carrier = trackingNumber
      ? window.prompt('شركة الشحن (اختياري، مثل: Aramex، عمان بوست):', '') || ''
      : ''
    const note = window.prompt('ملاحظة للمشتري (اختياري):', '') || ''
    await updateStatus(o.id, 'SHIPPED', { trackingNumber, carrier, note })
  }
  const handleDeliver = async (o) => {
    const note = window.prompt('ملاحظة تسليم (اختياري):', '') || ''
    await updateStatus(o.id, 'DELIVERED', { note })
  }
  const handleCancel = async (o) => {
    if (!window.confirm('إلغاء الطلب؟ هذا الإجراء لا يمكن التراجع عنه.')) return
    const note = window.prompt('سبب الإلغاء:', '') || ''
    await updateStatus(o.id, 'CANCELLED', { note })
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
  if (orders.length === 0) return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">لا توجد طلبات بعد</div>

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-gray-500">رقم الطلب: <span dir="ltr" className="text-[10px]">{o.id.slice(0, 8)}</span></div>
              <div className="text-xs text-gray-500">
                {new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(o.createdAt))}
              </div>
            </div>
            <span className={`inline-flex rounded-full px-3 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_BADGE[o.status]}`}>
              {ORDER_STATUS_LABELS[o.status]}
            </span>
          </div>
          <div className="mb-3 text-xs text-gray-600">
            <b>المشتري:</b> {o.buyer?.name} • <span dir="ltr">{o.buyer?.email}</span>
          </div>
          {o.shippingAddress && (
            <div className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
              <div><b>الشحن:</b> {o.shippingAddress.name} • {o.shippingAddress.phone}</div>
              <div>{o.shippingAddress.addressLine}{o.shippingAddress.city && `، ${o.shippingAddress.city}`}</div>
            </div>
          )}
          <div className="space-y-1.5">
            {o.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{it.nameAr} × {it.quantity}</span>
                <span className="font-semibold text-[#1B3A6B]">{formatOMR(it.lineSubtotal)} ر.ع</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
            <div>
              <div>إجمالي: <b>{formatOMR(o.vendorSubtotal)} ر.ع</b></div>
              <div className="text-red-600">عمولة {COMMISSION_PERCENT}%: − {formatOMR(o.vendorCommission)} ر.ع</div>
              <div className="text-green-700 font-bold">صافي: {formatOMR(o.vendorNet)} ر.ع</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.status === 'PAID' && (
                <>
                  <button onClick={() => handleShip(o)} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700">
                    <Truck className="h-3 w-3" /> شحن
                  </button>
                  <button onClick={() => handleCancel(o)} className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                    إلغاء
                  </button>
                </>
              )}
              {o.status === 'SHIPPED' && (
                <button onClick={() => handleDeliver(o)} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3" /> تسليم
                </button>
              )}
              {o.trackingNumber && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-mono font-semibold text-amber-700" dir="ltr">
                  📦 {o.trackingNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------- EARNINGS --------------- */
function EarningsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/vendor/orders').then((r) => r.json()).then((d) => {
      setData(d.earnings)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
  if (!data) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="إجمالي المبيعات" value={`${formatOMR(data.totalSales)} ر.ع`} color="from-blue-500 to-blue-700" icon={<ShoppingCart className="h-5 w-5" />} />
      <StatCard label={`عمولة المنصّة (${data.commissionPercent}%)`} value={`− ${formatOMR(data.totalCommission)} ر.ع`} color="from-red-500 to-red-700" icon={<AlertCircle className="h-5 w-5" />} />
      <StatCard label="صافي الأرباح" value={`${formatOMR(data.totalNet)} ر.ع`} color="from-green-600 to-green-800" icon={<Wallet className="h-5 w-5" />} />
      <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        عدد الطلبات: <b>{data.orderCount}</b>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-gradient-to-bl ${color} p-5 text-white`}>
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-white/15 p-1.5">{icon}</span>
        <span className="text-[11px] opacity-80">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold">{value}</div>
    </div>
  )
}

/* --------------- PROFILE --------------- */
function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState(false)
  const [f, setF] = useState({
    slug: '',
    businessName: '',
    tagline: '',
    bio: '',
    banner: '',
    logo: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    website: '',
    governorate: '',
    city: '',
    address: '',
  })

  useEffect(() => {
    fetch('/api/vendor/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setF({ ...f, ...d.profile })
        setLoading(false)
      })
  }, [])

  const onImage = async (e, field, maxDim = 1200, quality = 0.85) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const c = document.createElement('canvas')
          c.width = img.width * scale
          c.height = img.height * scale
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
          res(c.toDataURL('image/jpeg', quality))
        }
        img.onerror = rej
        img.src = reader.result
      }
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
    setF((x) => ({ ...x, [field]: dataUrl }))
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/vendor/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setMsg({ type: 'error', text: d.error || 'خطأ' })
    setF((x) => ({ ...x, slug: d.profile?.slug || x.slug }))
    setMsg({ type: 'success', text: 'تم حفظ البروفايل بنجاح' })
  }

  const storeUrl = f.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/store/vendor/${encodeURIComponent(f.slug)}`
    : ''
  const copyLink = async () => {
    if (!storeUrl) return
    try { await navigator.clipboard.writeText(storeUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  if (loading)
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>

  return (
    <div className="space-y-5">
      {/* Public URL */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C9A84C]/40 bg-gradient-to-bl from-[#FEF9E7] to-white p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-[#8a6f2d]">رابط متجرك العام</div>
          <div dir="ltr" className="mt-1 truncate font-mono text-sm text-[#1B3A6B]">{storeUrl || '—'}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
            {copied ? <><Check className="h-3 w-3 text-green-600" /> تم النسخ</> : <><Copy className="h-3 w-3" /> نسخ</>}
          </button>
          {f.slug && (
            <a href={storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#1B3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152c52]">
              <ExternalLink className="h-3 w-3" /> فتح المتجر
            </a>
          )}
        </div>
      </div>

      {/* Banner + logo */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div
          className="relative h-36 w-full bg-gradient-to-bl from-[#1B3A6B] to-[#C9A84C] md:h-44"
          style={f.banner ? { backgroundImage: `url(${f.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <label className="absolute bottom-3 left-3 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/65">
            <Upload className="h-3.5 w-3.5" /> بانر المتجر
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e, 'banner', 1600, 0.82)} />
          </label>
          {f.banner && (
            <button onClick={() => setF({ ...f, banner: '' })} className="absolute bottom-3 left-32 inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/65">
              <X className="h-3 w-3" /> إزالة
            </button>
          )}
        </div>
        <div className="-mt-12 flex flex-wrap items-end gap-4 px-5 pb-5 md:px-7">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#F8F9FA] shadow-md">
            {f.logo ? (
              <img src={f.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-bl from-[#1B3A6B] to-[#C9A84C] text-3xl font-extrabold text-white">{(f.businessName || '؟').charAt(0)}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-14 md:pt-16">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
              <Upload className="h-3.5 w-3.5" /> تحميل شعار
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e, 'logo', 512, 0.9)} />
            </label>
            {f.logo && (
              <button onClick={() => setF({ ...f, logo: '' })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <X className="h-3 w-3" /> إزالة الشعار
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fields */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#1B3A6B]">معلومات المتجر</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="اسم المتجر *">
            <input value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} className="input" />
          </F>
          <F label="الرابط المخصص" hint="3-60 حرفاً، بالإنجليزية أو العربية">
            <input dir="ltr" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} className="input text-right font-mono" />
          </F>
          <div className="sm:col-span-2">
            <F label="شعار قصير (Tagline)" hint="سطر قصير يصف متجرك">
              <input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} className="input" />
            </F>
          </div>
          <div className="sm:col-span-2">
            <F label="نبذة عن المتجر">
              <textarea rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className="input resize-none" />
            </F>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-[#1B3A6B]">التواصل والموقع</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="هاتف">
            <input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input text-right" />
          </F>
          <F label="واتساب">
            <input dir="ltr" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} className="input text-right" />
          </F>
          <F label="انستجرام (username)">
            <input dir="ltr" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} className="input text-right" />
          </F>
          <F label="الموقع الإلكتروني">
            <input dir="ltr" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="input text-right" />
          </F>
          <F label="المحافظة">
            <select value={f.governorate} onChange={(e) => setF({ ...f, governorate: e.target.value })} className="input">
              <option value="">اختر</option>
              {['MUSCAT','DHOFAR','MUSANDAM','BURAIMI','DAKHILIYAH','SHARQIYAH','WUSTA','BATINAH','DHAHIRAH'].map((g) => (
                <option key={g} value={g}>{ {MUSCAT:'مسقط',DHOFAR:'ظفار',MUSANDAM:'مسندم',BURAIMI:'البريمي',DAKHILIYAH:'الداخلية',SHARQIYAH:'الشرقية',WUSTA:'الوسطى',BATINAH:'الباطنة',DHAHIRAH:'الظاهرة'}[g] }</option>
              ))}
            </select>
          </F>
          <F label="المدينة">
            <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="input" />
          </F>
          <div className="sm:col-span-2">
            <F label="العنوان">
              <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="input" />
            </F>
          </div>
        </div>
      </section>

      {msg && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${msg.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#152c52] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          حفظ التغييرات
        </button>
      </div>

      <style jsx>{`.input{width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:#1B3A6B;box-shadow:0 0 0 3px rgba(27,58,107,0.1)}`}</style>
    </div>
  )
}
