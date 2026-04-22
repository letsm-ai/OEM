'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })
    if (res?.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B3A6B]/10">
              <LogIn className="h-6 w-6 text-[#1B3A6B]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1B3A6B]">تسجيل الدخول</h1>
            <p className="mt-1 text-sm text-gray-500">
              أهلاً بعودتك إلى مجلس رواد الأعمال
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-right text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder="••••••••"
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
                  جارِ تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            ليس لديك حساب؟{' '}
            <Link
              href="/signup"
              className="font-semibold text-[#1B3A6B] hover:underline"
            >
              أنشئ حساباً جديداً
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
