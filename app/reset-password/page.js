'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('الرابط غير صالح')
      return
    }
    if (form.password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل')
      return
    }
    if (form.password !== form.confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'تعذر إعادة تعيين كلمة المرور')
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 2500)
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
                  <KeyRound className="h-6 w-6 text-[#1B3A6B]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1B3A6B]">
                  كلمة مرور جديدة
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  أدخل كلمة مرور جديدة آمنة (6 أحرف على الأقل)
                </p>
              </div>

              {!token && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
                  الرابط غير صالح. يرجى طلب رابط جديد.
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    تأكيد كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B3A6B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#152c52] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    'تعيين كلمة المرور'
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
              <h2 className="text-xl font-bold text-[#1B3A6B]">تم تغيير كلمة المرور بنجاح</h2>
              <p className="mt-2 text-sm text-gray-600">جاري تحويلك لصفحة الدخول...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">جاري التحميل...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
