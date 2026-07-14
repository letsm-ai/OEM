'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Loader2, UserPlus } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, isRTL } = useI18n()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Read continuation params so we can resume the flow the user came from
  // (e.g. /membership → Subscribe → Signup → back to /membership with tier=X).
  const nextPath = searchParams?.get('next') || ''
  const tierParam = searchParams?.get('tier') || ''
  const trialParam = searchParams?.get('trial') || ''

  const buildContinueUrl = () => {
    // Only allow same-origin paths (starts with "/"), never external redirects.
    if (!nextPath || !nextPath.startsWith('/')) return '/dashboard'
    const extras = []
    if (tierParam) extras.push(`tier=${encodeURIComponent(tierParam)}`)
    if (trialParam) extras.push(`trial=${encodeURIComponent(trialParam)}`)
    if (extras.length === 0) return nextPath
    const sep = nextPath.includes('?') ? '&' : '?'
    return `${nextPath}${sep}${extras.join('&')}`
  }

  // Signup CTA can preserve the "already have account?" link params too
  const buildLoginHref = () => {
    const params = new URLSearchParams()
    if (nextPath) params.set('callbackUrl', buildContinueUrl())
    const qs = params.toString()
    return qs ? `/login?${qs}` : '/login'
  }

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
        setError(data.error || t('auth.signup.error.generic'))
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
      const dest = buildContinueUrl()
      router.push(dest)
      router.refresh()
    } catch (err) {
      setError(t('auth.signup.error.network'))
      setLoading(false)
    }
  }

  const emailAlign = isRTL ? 'text-right' : 'text-left'

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B3A6B]/10">
              <UserPlus className="h-6 w-6 text-[#1B3A6B]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1B3A6B]">
              {t('auth.signup.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('auth.signup.subtitle')}
            </p>
          </div>

          {/* Continuation intent banner — shown when the user came from a
              "Subscribe" / "Start trial" button and we need them to create an
              account before completing the flow. */}
          {(tierParam || trialParam) && (
            <div className="mb-4 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 text-center text-xs text-[#8a6f2d]">
              {trialParam
                ? '🎁 أنشئ حسابك المجاني الآن لتفعيل التجربة المجانية مباشرةً'
                : '👑 أنشئ حسابك خلال ثوانٍ لإتمام الاشتراك في الباقة المختارة'}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('auth.signup.name')}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder={t('auth.signup.namePlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('auth.login.email')}
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`w-full rounded-lg border border-gray-300 px-4 py-2.5 ${emailAlign} text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10`}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('auth.login.password')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
                placeholder={t('auth.signup.passwordPlaceholder')}
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
                  {t('auth.signup.loading')}
                </>
              ) : (
                t('auth.signup.submit')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            {t('auth.signup.haveAccount')}{' '}
            <Link
              href={buildLoginHref()}
              className="font-semibold text-[#1B3A6B] hover:underline"
            >
              {t('auth.signup.loginNow')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
