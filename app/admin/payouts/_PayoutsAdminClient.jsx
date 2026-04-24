'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2, XCircle, DollarSign, Clock, Banknote } from 'lucide-react'

const formatOMR = (n) => Number(n || 0).toFixed(2)

const STATUS_LABELS = {
  PENDING: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800', icon: Clock },
  APPROVED: { label: 'موافق عليه', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  PAID: { label: 'تم التحويل', color: 'bg-green-100 text-green-800', icon: Banknote },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-800', icon: XCircle },
}

export default function PayoutsAdminClient() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [action, setAction] = useState(null) // {type: 'reject'|'mark-paid', req}

  const load = async () => {
    setLoading(true)
    const qs = filter !== 'ALL' ? `?status=${filter}` : ''
    const r = await fetch(`/api/admin/payouts${qs}`)
    const d = await r.json()
    setRequests(d.requests || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  const onApprove = async (req) => {
    if (!confirm(`الموافقة على دفع ${formatOMR(req.amountRequested)} ر.ع للبائع ${req.vendorName}؟`)) return
    await fetch(`/api/admin/payouts/${req.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    load()
  }

  const summary = {
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    paid: requests.filter((r) => r.status === 'PAID').length,
    totalPaid: requests.filter((r) => r.status === 'PAID').reduce((s, r) => s + r.amountRequested, 0),
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-[#1B3A6B]">💰 إدارة طلبات السحب</h1>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniCard icon={<Clock className="h-5 w-5" />} label="قيد المراجعة" value={summary.pending} color="amber" />
        <MiniCard icon={<CheckCircle2 className="h-5 w-5" />} label="موافق عليه" value={summary.approved} color="blue" />
        <MiniCard icon={<Banknote className="h-5 w-5" />} label="تم التحويل" value={summary.paid} color="green" />
        <MiniCard icon={<DollarSign className="h-5 w-5" />} label="إجمالي المدفوع" value={`${formatOMR(summary.totalPaid)} ر.ع`} color="gold" />
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm overflow-x-auto">
        {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold whitespace-nowrap ${filter === f ? 'bg-[#1B3A6B] text-white shadow' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {f === 'ALL' ? 'الكل' : STATUS_LABELS[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          لا توجد طلبات
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const s = STATUS_LABELS[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
            return (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.color}`}>{s.label}</span>
                      <span className="text-2xl font-extrabold text-[#1B3A6B]">{formatOMR(r.amountRequested)} <span className="text-xs">ر.ع</span></span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">{r.vendorName}</div>
                    <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                      <div>💳 <b>{r.bankDetails?.bankName}</b></div>
                      <div>👤 {r.bankDetails?.accountHolderName}</div>
                      <div className="sm:col-span-2">IBAN: <span dir="ltr" className="font-mono font-bold">{r.bankDetails?.iban}</span></div>
                      {r.bankDetails?.note && <div className="sm:col-span-2 text-gray-500">ملاحظة: {r.bankDetails.note}</div>}
                    </div>
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-800">سبب الرفض: {r.rejectionReason}</div>
                    )}
                    {r.status === 'PAID' && r.transferReference && (
                      <div className="mt-2 rounded-md bg-green-50 px-2 py-1 text-[11px] text-green-800">مرجع التحويل: <span dir="ltr" className="font-bold">{r.transferReference}</span></div>
                    )}
                    <div className="mt-2 text-[10px] text-gray-400">
                      طُلب: {new Date(r.requestedAt).toLocaleString('ar-OM')}
                      {r.processedAt && ` · معالَج: ${new Date(r.processedAt).toLocaleString('ar-OM')}`}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {r.status === 'PENDING' && (
                      <>
                        <button onClick={() => onApprove(r)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">موافقة</button>
                        <button onClick={() => setAction({ type: 'reject', req: r })} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600">رفض</button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button onClick={() => setAction({ type: 'mark-paid', req: r })} className="rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-bold text-[#1B3A6B] hover:bg-[#b89440]">تسجيل كمدفوع</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {action && (
        <ActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); load() }} />
      )}
    </div>
  )
}

function MiniCard({ icon, label, value, color }) {
  const colors = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    gold: 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#1B3A6B]',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 text-[11px] opacity-80">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  )
}

function ActionModal({ action, onClose, onDone }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const title = action.type === 'reject' ? 'رفض طلب السحب' : 'تسجيل التحويل البنكي'
  const labelText = action.type === 'reject' ? 'سبب الرفض *' : 'مرجع التحويل البنكي *'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!value.trim()) return setError('هذا الحقل مطلوب')
    setLoading(true)
    const body = action.type === 'reject'
      ? { reason: value.trim() }
      : { transferReference: value.trim() }
    const res = await fetch(
      `/api/admin/payouts/${action.req.id}/${action.type === 'reject' ? 'reject' : 'mark-paid'}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(d?.error || 'خطأ')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-16 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-2 text-base font-bold text-[#1B3A6B]">{title}</h3>
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
          <div>البائع: <b>{action.req.vendorName}</b></div>
          <div>المبلغ: <b className="text-[#1B3A6B]">{formatOMR(action.req.amountRequested)} ر.ع</b></div>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-semibold">{labelText}</label>
          {action.type === 'reject' ? (
            <textarea required rows={3} value={value} onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          ) : (
            <input required value={value} onChange={(e) => setValue(e.target.value)} dir="ltr"
              placeholder="BM-TRX-2025-00123"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
          )}
        </div>
        {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800"><AlertCircle className="inline-block h-3.5 w-3.5" /> {error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50">إلغاء</button>
          <button type="submit" disabled={loading} className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${action.type === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {action.type === 'reject' ? 'رفض' : 'تأكيد الدفع'}
          </button>
        </div>
      </form>
    </div>
  )
}
