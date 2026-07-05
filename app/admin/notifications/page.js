'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Bell, Send, Loader2, ArrowRight, Users, Globe } from 'lucide-react'

export default function AdminNotificationsPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    url: '/',
    image: '',
    lang: 'all',
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login?callbackUrl=/admin/notifications')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      redirect('/')
    }
  }, [status, session])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/push/stats')
        if (res.ok) setStats(await res.json())
      } catch (e) {
        /* ignore */
      }
    }
    if (status === 'authenticated') load()
  }, [status])

  const send = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    setResult(null)
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        url: form.url || '/',
        image: form.image || undefined,
        lang: form.lang === 'all' ? undefined : form.lang,
      }
      const res = await fetch('/api/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل الإرسال')
      } else {
        setResult(data)
        // refresh stats
        const s = await fetch('/api/admin/push/stats')
        if (s.ok) setStats(await s.json())
      }
    } catch (e) {
      setError('خطأ في الشبكة')
    } finally {
      setSending(false)
    }
  }

  if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') {
    return (
      <div className="container mx-auto py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1B3A6B]" />
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-3xl px-4">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
          <ArrowRight className="h-4 w-4 rotate-180" /> لوحة الإدارة
        </Link>

        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
            <Bell className="h-4 w-4" /> إشعارات Push
          </div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            إرسال إشعار جماعي
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            سيصل الإشعار لجميع الزوار والأعضاء الذين فعّلوا الإشعارات
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Users} label="مشتركين نشطين" value={stats.active} tone="teal" />
            <StatCard icon={Globe} label="عربي" value={stats.ar} tone="blue" />
            <StatCard icon={Globe} label="إنجليزي" value={stats.en} tone="indigo" />
            <StatCard icon={Shield} label="مسجّلون" value={stats.authed} tone="amber" />
          </div>
        )}

        {/* Form */}
        <form onSubmit={send} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">العنوان *</label>
            <input
              type="text"
              required
              maxLength={80}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عرض حصري للأعضاء الذهبيين!"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
            />
            <div className="mt-0.5 text-[10px] text-gray-400">{form.title.length}/80</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">النص *</label>
            <textarea
              required
              maxLength={200}
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="خصم 20% على جميع منتجات المتجر لهذا الأسبوع فقط."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
            />
            <div className="mt-0.5 text-[10px] text-gray-400">{form.body.length}/200</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">رابط عند الضغط</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="/store"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">اللغة المستهدفة</label>
              <select
                value={form.lang}
                onChange={(e) => setForm({ ...form, lang: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
              >
                <option value="all">الكل</option>
                <option value="ar">العربية فقط</option>
                <option value="en">الإنجليزية فقط</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">صورة (اختياري)</label>
            <input
              type="url"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://... (صورة كبيرة تظهر مع الإشعار)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              ✅ تم الإرسال إلى <strong>{result.targeted}</strong> جهاز — نجح: {result.sent} • فشل: {result.failed} • مُلغى: {result.disabled}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !form.title || !form.body}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B3A6B] py-2.5 text-sm font-bold text-white transition hover:bg-[#152c52] disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> إرسال الإشعار
              </>
            )}
          </button>

          <p className="text-[11px] text-gray-500">
            ⚠️ الإشعار سيُرسل فوراً لجميع المشتركين. لا يمكن التراجع.
          </p>
        </form>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    teal: 'from-teal-500/10 to-teal-500/5 text-teal-700',
    blue: 'from-blue-500/10 to-blue-500/5 text-blue-700',
    indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-700',
    amber: 'from-amber-500/10 to-amber-500/5 text-amber-700',
  }
  return (
    <div className={`rounded-xl border border-gray-200 bg-gradient-to-br ${tones[tone] || ''} p-3`}>
      <div className="flex items-center gap-1.5 text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-[#1B3A6B]">{value ?? 0}</div>
    </div>
  )
}
