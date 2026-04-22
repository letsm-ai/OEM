'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'حدث خطأ ما')
      } else {
        setDone(true)
      }
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {!done ? (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B3A6B]/10">
                  <Mail className="h-6 w-6 text-[#1B3A6B]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1B3A6B]">
                  نسيت كلمة المرور؟
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-right text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                    placeholder="name@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B3A6B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#152c52] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    'إرسال رابط الاستعادة'
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600">
                <Link href="/login" className="font-semibold text-[#1B3A6B] hover:underline">
                  العودة لتسجيل الدخول
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-[#1B3A6B]">تم إرسال الرابط</h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                إذا كان هذا البريد مسجلاً لدينا، فقد أرسلنا رابط إعادة تعيين كلمة المرور إلى
                <br />
                <strong dir="ltr" className="text-[#1B3A6B]">{email}</strong>
              </p>
              <p className="mt-3 text-xs text-gray-500">
                تحقّق من مجلد البريد المزعج إن لم تجد الرسالة. الرابط صالح لمدة ساعة فقط.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-lg bg-[#1B3A6B] px-6 py-2 text-sm font-semibold text-white"
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
