'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar as CalendarIcon, Loader2, CheckCircle2, X, Clock } from 'lucide-react'
import { DAY_NAMES_AR, computeSessionPrice } from '@/lib/experts'
import { TIER_DISCOUNT } from '@/lib/membership'

function addDaysUTC(d, n) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
function fmtDateAr(d) {
  try {
    return new Intl.DateTimeFormat('ar', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function BookingWidget({
  expertId,
  hourlyRate,
  expertName,
  clientTier,
  authenticated,
}) {
  const router = useRouter()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  const [availableDayOfWeek, setAvailableDayOfWeek] = useState(new Set())
  const [selectedDate, setSelectedDate] = useState(null) // Date
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [booking, setBooking] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  // Guest fields (only used if not authenticated)
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' })

  // Load weekly availability to highlight clickable days
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/experts/${expertId}/availability`)
      if (res.ok) {
        const data = await res.json()
        const days = new Set((data.availability || []).map((a) => a.dayOfWeek))
        setAvailableDayOfWeek(days)
      }
    }
    load()
  }, [expertId])

  // Generate next 30 days
  const days = Array.from({ length: 30 }).map((_, i) => addDaysUTC(today, i))

  const pickDate = async (d) => {
    setSelectedDate(d)
    setSelectedSlot(null)
    setSlotsLoading(true)
    setSlots([])
    setError('')
    try {
      const res = await fetch(
        `/api/experts/${expertId}/slots?date=${isoDate(d)}`
      )
      const data = await res.json()
      setSlots(data.slots || [])
    } catch {
      setError('تعذر تحميل المواعيد')
    } finally {
      setSlotsLoading(false)
    }
  }

  const confirm = async () => {
    if (!selectedDate || !selectedSlot) return
    // Validate guest info if not authenticated
    if (!authenticated) {
      const gName = guest.name.trim()
      const gEmail = guest.email.trim()
      if (!gName || !gEmail) {
        setError('للحجز كضيف، الاسم والبريد الإلكتروني مطلوبان')
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail)) {
        setError('صيغة البريد الإلكتروني غير صحيحة')
        return
      }
    }
    setBooking(true)
    setError('')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId,
          date: isoDate(selectedDate),
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          ...(authenticated ? {} : { guest }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'تعذر الحجز')
      } else {
        setSuccess(data.appointment)
      }
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setBooking(false)
    }
  }

  // (Guests CAN now book — no early return for unauthenticated users.)

  if (availableDayOfWeek.size === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">
          لم يحدد الخبير مواعيده الأسبوعية بعد
        </p>
      </div>
    )
  }

  const priceInfo = computeSessionPrice(
    hourlyRate,
    TIER_DISCOUNT[clientTier] || 0
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B3A6B] py-3 text-sm font-semibold text-white transition hover:bg-[#152c52]"
      >
        <CalendarIcon className="h-4 w-4" />
        احجز جلسة استشارية
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] px-6 py-4 text-white">
              <div>
                <div className="text-xs text-gray-300">حجز جلسة مع</div>
                <div className="text-base font-bold">{expertName}</div>
              </div>
              <button
                onClick={() => {
                  setOpen(false)
                  setSuccess(null)
                  setSelectedDate(null)
                  setSelectedSlot(null)
                  setError('')
                }}
                className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success */}
            {success ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-[#1B3A6B]">تم تأكيد الحجز</h3>
                <p className="mt-2 text-sm text-gray-600">
                  موعدك مع <strong>{expertName}</strong> يوم{' '}
                  <strong>{fmtDateAr(new Date(success.date))}</strong> الساعة{' '}
                  <strong>{success.startTime}</strong>
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  المبلغ المدفوع: <strong>{success.totalPaid} ر.ع</strong>
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setOpen(false)
                      router.push('/consultations/my-bookings')
                    }}
                    className="rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white"
                  >
                    عرض حجوزاتي
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false)
                      setSuccess(null)
                    }}
                    className="rounded-lg border border-gray-300 px-5 py-2 text-sm"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Date */}
                <div className="border-b border-gray-100 px-6 py-4">
                  <div className="mb-3 text-sm font-bold text-[#1B3A6B]">
                    1. اختر التاريخ (الأيام الفعّالة فقط)
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map((d) => {
                      const enabled = availableDayOfWeek.has(d.getUTCDay())
                      const isSel =
                        selectedDate &&
                        isoDate(selectedDate) === isoDate(d)
                      return (
                        <button
                          key={isoDate(d)}
                          disabled={!enabled}
                          onClick={() => pickDate(d)}
                          className={`flex min-w-[72px] shrink-0 flex-col items-center rounded-xl border p-2 text-xs transition ${
                            isSel
                              ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                              : enabled
                              ? 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A84C]'
                              : 'border-gray-100 bg-gray-50 text-gray-300'
                          }`}
                        >
                          <span className="font-medium">
                            {DAY_NAMES_AR[d.getUTCDay()]}
                          </span>
                          <span className="mt-0.5 text-lg font-bold">
                            {d.getUTCDate()}
                          </span>
                          <span className="text-[10px]">
                            {d.toLocaleDateString('ar', { month: 'short' })}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Step 2: Slots */}
                {selectedDate && (
                  <div className="border-b border-gray-100 px-6 py-4">
                    <div className="mb-3 text-sm font-bold text-[#1B3A6B]">
                      2. اختر الوقت
                    </div>
                    {slotsLoading ? (
                      <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري التحميل...
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                        لا توجد مواعيد متاحة في هذا اليوم — جرّب يوماً آخر
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                        {slots.map((s) => {
                          const isSel =
                            selectedSlot &&
                            selectedSlot.startTime === s.startTime
                          return (
                            <button
                              key={s.startTime}
                              onClick={() => setSelectedSlot(s)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                isSel
                                  ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A84C]'
                              }`}
                            >
                              <Clock className="ml-1 inline h-3 w-3" />
                              {s.startTime}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2.5: Guest info (if not authenticated) */}
                {selectedDate && selectedSlot && !authenticated && (
                  <div className="border-b border-gray-100 px-6 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-bold text-[#1B3A6B]">3. بياناتك</div>
                      <Link
                        href={`/login?callbackUrl=/consultations/${expertId}`}
                        className="text-xs font-semibold text-[#C9A84C] hover:underline"
                      >
                        لديك حساب؟ سجّل دخول
                      </Link>
                    </div>
                    <div className="mb-2 rounded-md bg-blue-50 px-3 py-1.5 text-[11px] text-blue-800">
                      🛒 يمكنك إكمال الحجز كضيف بدون إنشاء حساب
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={guest.name}
                        onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                        placeholder="الاسم الكامل *"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none"
                      />
                      <input
                        type="email"
                        value={guest.email}
                        onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                        placeholder="البريد الإلكتروني *"
                        dir="ltr"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-right focus:border-[#1B3A6B] focus:outline-none"
                      />
                      <input
                        type="tel"
                        value={guest.phone}
                        onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                        placeholder="رقم الهاتف"
                        dir="ltr"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-right focus:border-[#1B3A6B] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Summary */}
                {selectedDate && selectedSlot && (
                  <div className="border-b border-gray-100 px-6 py-4">
                    <div className="mb-3 text-sm font-bold text-[#1B3A6B]">
                      3. ملخص الحجز
                    </div>
                    <div className="space-y-2 rounded-xl bg-[#F8F9FA] p-4 text-sm">
                      <Row label="الخبير" value={expertName} />
                      <Row
                        label="التاريخ"
                        value={fmtDateAr(selectedDate)}
                      />
                      <Row
                        label="الوقت"
                        value={`${selectedSlot.startTime} - ${selectedSlot.endTime}`}
                      />
                      <div className="my-2 h-px bg-gray-200" />
                      <Row
                        label="السعر الأصلي"
                        value={`${priceInfo.originalPrice} ر.ع`}
                      />
                      {priceInfo.discountPercent > 0 && (
                        <Row
                          label={`خصم الأعضاء (${priceInfo.discountPercent}%)`}
                          value={`- ${priceInfo.discountAmount} ر.ع`}
                          green
                        />
                      )}
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                        <span className="font-semibold text-[#1B3A6B]">
                          الإجمالي
                        </span>
                        <span className="text-lg font-extrabold text-[#1B3A6B]">
                          {priceInfo.finalPrice} ر.ع
                        </span>
                      </div>
                    </div>
                    {error && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                      </div>
                    )}
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                      🔒 الدفع يتم مباشرة مع الخبير — لا يتم تحصيل الدفع إلكترونياً في هذه المرحلة.
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 bg-gray-50 px-6 py-4">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirm}
                    disabled={!selectedSlot || booking}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
                  >
                    {booking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري التأكيد...
                      </>
                    ) : (
                      'تأكيد الحجز والدفع'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Row({ label, value, green = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={green ? 'font-semibold text-green-700' : 'font-semibold text-gray-800'}>
        {value}
      </span>
    </div>
  )
}
