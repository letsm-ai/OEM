'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'

export default function UnsubscribeClient({ defaultEmail = '', token = '' }) {
  const [email, setEmail] = useState(defaultEmail)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [msg, setMsg] = useState('')

  // If the URL already carried an email + token (signed link from an email),
  // silently confirm the opt-out on load.
  useEffect(() => {
    if (defaultEmail && token && status === 'idle') {
      submit(defaultEmail)
    }
  }, [])

  const submit = async (targetEmail) => {
    const e = String(targetEmail || email || '').trim().toLowerCase()
    if (!e.includes('@')) {
      setStatus('error')
      setMsg('صيغة البريد غير صحيحة')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setMsg(data.error || 'تعذّر معالجة الطلب')
        return
      }
      setStatus('done')
      setMsg(e)
    } catch (err) {
      setStatus('error')
      setMsg('تعذّر الاتصال بالخادم — حاول لاحقاً')
    }
  }

  const isConfirmed = status === 'done'

  return (
    <div className="min-h-[70vh] bg-[#F8F9FA] py-12">
      <div className="container mx-auto max-w-xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {status === 'loading' ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#1B3A6B]" />
              <div className="text-sm font-semibold text-gray-700">
                جارٍ معالجة طلبك...
              </div>
            </div>
          ) : isConfirmed ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="mb-2 text-2xl font-extrabold text-[#1B3A6B]">
                تم إلغاء الاشتراك بنجاح
              </h1>
              <p className="mb-6 text-sm text-gray-600">
                لن يتم إرسال أي رسائل ترويجية إلى{' '}
                <span className="font-semibold text-[#1B3A6B]">{msg}</span> بعد الآن.
                <br />
                <span className="text-xs text-gray-500">
                  ملاحظة: رسائل الحساب الأساسية (تأكيدات الاشتراك، إعادة تعيين كلمة
                  المرور، تأكيدات الطلبات) ستستمر لأنها ضرورية لحسابك.
                </span>
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-5 py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
              >
                العودة للرئيسية
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3A6B]/10">
                  <Mail className="h-8 w-8 text-[#1B3A6B]" />
                </div>
                <h1 className="mb-1 text-2xl font-extrabold text-[#1B3A6B]">
                  إلغاء الاشتراك
                </h1>
                <p className="text-sm text-gray-600">
                  أدخل بريدك الإلكتروني وسنتوقّف عن إرسال الرسائل الترويجية إليك.
                </p>
              </div>

              {status === 'error' && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {msg}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submit()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    البريد الإلكتروني *
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    السبب (اختياري)
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="ساعدنا لنتحسّن..."
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  إلغاء الاشتراك من الرسائل الترويجية
                </button>

                <p className="text-center text-xs text-gray-500">
                  أو راسلنا على{' '}
                  <a
                    href="mailto:support@omanimajles.com"
                    className="font-semibold text-[#1B3A6B] underline"
                  >
                    support@omanimajles.com
                  </a>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
