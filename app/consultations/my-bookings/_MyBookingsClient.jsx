'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, XCircle, CheckCircle2, Loader2 } from 'lucide-react'

const STATUS_LABEL = {
  PENDING: 'قيد التأكيد',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
}
const STATUS_CLASS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat('ar', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso?.slice(0, 10)
  }
}

function hoursUntil(iso, start) {
  const d = new Date(iso)
  const [h, m] = start.split(':').map(Number)
  d.setUTCHours(h, m, 0, 0)
  return (d.getTime() - Date.now()) / (1000 * 60 * 60)
}

export default function MyBookingsClient({ appointments }) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState(null)

  const cancel = async (id) => {
    if (!confirm('هل ترغب بإلغاء هذا الحجز؟')) return
    setCancellingId(id)
    const res = await fetch(`/api/appointments/${id}/cancel`, { method: 'POST' })
    setCancellingId(null)
    if (res.ok) router.refresh()
    else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'تعذر الإلغاء')
    }
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-3 text-lg font-bold text-gray-700">لا توجد حجوزات</h3>
        <p className="mt-1 text-sm text-gray-500">ابدأ بحجز جلسة مع أحد الخبراء</p>
        <Link
          href="/consultations"
          className="mt-4 inline-flex rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white"
        >
          تصفّح الخبراء
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {appointments.map((a) => {
        const canCancel =
          a.status === 'CONFIRMED' && hoursUntil(a.date, a.startTime) > 24
        return (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              {a.expert?.photo ? (
                <img
                  src={a.expert.photo}
                  alt=""
                  className="h-12 w-12 rounded-full border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1B3A6B]/5 font-bold text-[#1B3A6B]">
                  {a.expert?.name?.charAt(0) || 'خ'}
                </div>
              )}
              <div>
                <div className="font-bold text-[#1B3A6B]">
                  {a.expert?.name || 'خبير'}
                </div>
                <div className="mt-0.5 text-xs text-gray-600">
                  {a.expert?.specialtyAr}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                  <span>{fmtDate(a.date)}</span>
                  <span>•</span>
                  <span>
                    {a.startTime} - {a.endTime}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASS[a.status]
                    }`}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="text-xs text-gray-500">المبلغ</div>
                <div className="text-sm font-bold text-[#1B3A6B]">
                  {a.totalPaid} ر.ع
                </div>
              </div>
              {canCancel ? (
                <button
                  onClick={() => cancel(a.id)}
                  disabled={cancellingId === a.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {cancellingId === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  إلغاء
                </button>
              ) : a.status === 'CONFIRMED' ? (
                <span className="text-xs text-gray-400">لا يمكن الإلغاء (&lt;24س)</span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
