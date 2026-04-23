'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, XCircle, Star, Loader2, X, CheckCircle2 } from 'lucide-react'

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

function isPast(iso, endTime) {
  const d = new Date(iso)
  const [h, m] = (endTime || '00:00').split(':').map(Number)
  d.setUTCHours(h, m, 0, 0)
  return d.getTime() < Date.now()
}

export default function MyBookingsClient({ appointments }) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState(null)
  const [reviewing, setReviewing] = useState(null) // appointment object

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
    <>
      <div className="space-y-3">
        {appointments.map((a) => {
          const canCancel =
            a.status === 'CONFIRMED' && hoursUntil(a.date, a.startTime) > 24
          const past = isPast(a.date, a.endTime)
          const canReview =
            past &&
            a.status !== 'CANCELLED' &&
            !a.reviewedAt
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
                    {a.rating && (
                      <span className="inline-flex items-center gap-0.5 text-[#C9A84C]">
                        {Array.from({ length: a.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-[#C9A84C]" />
                        ))}
                      </span>
                    )}
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
                {canReview && (
                  <button
                    onClick={() => setReviewing(a)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-semibold text-[#1B3A6B] hover:bg-[#b89440]"
                  >
                    <Star className="h-3.5 w-3.5" />
                    قيّم الجلسة
                  </button>
                )}
                {canCancel && (
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
                )}
                {!canCancel && a.status === 'CONFIRMED' && (
                  <span className="text-xs text-gray-400">&lt;24س</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {reviewing && (
        <ReviewModal
          appointment={reviewing}
          onClose={() => setReviewing(null)}
          onSuccess={() => {
            setReviewing(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function ReviewModal({ appointment, onClose, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (rating < 1) return setError('اختر تقييماً أولاً')
    setLoading(true)
    setError('')
    const res = await fetch(`/api/appointments/${appointment.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'تعذر إرسال التقييم')
      return
    }
    setDone(true)
    setTimeout(() => onSuccess(), 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] px-6 py-4 text-white">
          <div>
            <div className="text-xs text-gray-300">تقييم الجلسة مع</div>
            <div className="text-base font-bold">{appointment.expert?.name}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        {done ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-3 text-lg font-bold text-[#1B3A6B]">تم إرسال تقييمك بنجاح</h3>
            <p className="mt-1 text-sm text-gray-600">شكراً لك على مشاركتك تجربتك</p>
          </div>
        ) : (
          <div className="p-6">
            <p className="mb-4 text-sm text-gray-700 text-center">
              كيف كانت تجربتك مع هذا الخبير؟
            </p>
            <div className="mb-6 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 transition"
                >
                  <Star
                    className={`h-9 w-9 transition ${
                      n <= (hover || rating)
                        ? 'fill-[#C9A84C] text-[#C9A84C]'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              تعليقك (اختياري)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="شاركنا رأيك في الجلسة..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
            />
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                disabled={loading || rating < 1}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  'إرسال التقييم'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
