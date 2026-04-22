'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'

export default function AdminCompanyActions({ companyId, currentStatus }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')

  const approve = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/companies/${companyId}/approve`, {
      method: 'POST',
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert('تعذر الاعتماد')
    }
  }

  const reject = async () => {
    if (!reason.trim()) {
      alert('يرجى كتابة سبب الرفض')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/admin/companies/${companyId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setLoading(false)
    if (res.ok) {
      setShowReject(false)
      router.refresh()
    } else {
      alert('تعذر الرفض')
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
      {currentStatus !== 'APPROVED' && (
        <button
          onClick={approve}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          اعتماد
        </button>
      )}
      {currentStatus !== 'REJECTED' && (
        <>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" />
              رفض
            </button>
          ) : (
            <div className="w-full min-w-[240px] rounded-lg border border-red-200 bg-red-50 p-2 md:w-64">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب الرفض..."
                rows={2}
                className="w-full rounded-md border border-red-200 bg-white px-2 py-1 text-xs outline-none focus:border-red-400"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={reject}
                  disabled={loading || !reason.trim()}
                  className="flex-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {loading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'تأكيد الرفض'}
                </button>
                <button
                  onClick={() => {
                    setShowReject(false)
                    setReason('')
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
