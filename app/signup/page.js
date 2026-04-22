'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Loader2, UserPlus } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'حدث خطأ ما')
        setLoading(false)
        return
      }
      // Auto-login
      const signInRes = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })
      if (signInRes?.error) {
        setError(signInRes.error)
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('تعذر إنشاء الحساب، حاول مرة أخرى')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B3A6B]/10">
              <UserPlus className="h-6 w-6 text-[#1B3A6B]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1B3A6B]">
              إنشاء حساب جديد
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              انضم إلى مجلس رواد الأعمال العماني
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
                الاسم الكامل
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder="مثال: أحمد السعدي"
              />
            </div>
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
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder="6 أحرف على الأقل"
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
                  جارِ إنشاء الحساب...
                </>
              ) : (
                'إنشاء الحساب'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            لديك حساب بالفعل؟{' '}
            <Link
              href="/login"
              className="font-semibold text-[#1B3A6B] hover:underline"
            >
              سجّل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
