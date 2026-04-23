'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Clock, Crown } from 'lucide-react'
import { VENDOR_APP_STATUS_LABELS, VENDOR_APP_STATUS_BADGE } from '@/lib/store'

export default function AdminVendorAppsClient() {
  const [status, setStatus] = useState('PENDING')
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/admin/vendor-applications?status=${status}`)
    const d = await r.json()
    setApps(d.applications || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [status])

  const act = async (id, action, note) => {
    await fetch(`/api/admin/vendor-applications/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || '' }),
    })
    load()
  }

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {['PENDING', 'APPROVED', 'REJECTED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              status === s ? 'bg-[#1B3A6B] text-white shadow' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {VENDOR_APP_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          <Clock className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          لا توجد طلبات {VENDOR_APP_STATUS_LABELS[status]}
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="font-bold text-[#1B3A6B]">{a.businessName}</div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${VENDOR_APP_STATUS_BADGE[a.status]}`}>
                      {VENDOR_APP_STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    مقدم من: <b>{a.user?.name}</b> • <span dir="ltr">{a.user?.email}</span>
                    <span className="ms-2 inline-flex items-center gap-0.5 rounded-full bg-[#C9A84C]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6f2d]">
                      <Crown className="h-2.5 w-2.5" /> {a.user?.membershipTier}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(a.createdAt))}
                </div>
              </div>
              {a.businessDescription && (
                <p className="mb-2 whitespace-pre-wrap text-sm text-gray-700">{a.businessDescription}</p>
              )}
              {a.phone && <div className="text-xs text-gray-500">هاتف: <span dir="ltr">{a.phone}</span></div>}
              {a.adminNote && (
                <div className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">ملاحظة المراجع: {a.adminNote}</div>
              )}
              {a.status === 'PENDING' && (
                <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => act(a.id, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> قبول
                  </button>
                  <button onClick={() => {
                    const note = prompt('سبب الرفض (اختياري):') || ''
                    act(a.id, 'reject', note)
                  }} className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-4 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" /> رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
