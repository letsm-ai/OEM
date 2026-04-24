'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, GraduationCap, Store, Wallet, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { SkeletonStats } from '@/components/Skeleton'

export default function ApprovalsClient() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/approvals/summary')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'خطأ')
        return j
      })
      .then((j) => { if (!cancelled) setData(j) })
      .catch((e) => { if (!cancelled) setErr(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <SkeletonStats count={4} />
  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <AlertCircle className="h-5 w-5" /> {err}
      </div>
    )
  }
  if (!data) return null

  const sections = [
    { key: 'companies', label: 'شركات بانتظار المراجعة', count: data.companies, href: '/admin/companies?status=PENDING', Icon: Building2, color: 'from-cyan-500 to-cyan-700', desc: 'مراجعة طلبات تسجيل الشركات في الدليل' },
    { key: 'experts', label: 'خبراء بانتظار المراجعة', count: data.experts, href: '/admin/experts?status=PENDING', Icon: GraduationCap, color: 'from-indigo-500 to-indigo-700', desc: 'مراجعة سيرة وتخصص الخبراء قبل الاعتماد' },
    { key: 'vendors', label: 'بائعون بانتظار التفعيل', count: data.vendors, href: '/admin/vendor-applications?status=PENDING', Icon: Store, color: 'from-emerald-500 to-emerald-700', desc: 'تفعيل حسابات البائعين في المتجر' },
    { key: 'payouts', label: 'طلبات سحب أرباح', count: data.payouts, href: '/admin/payouts?status=PENDING', Icon: Wallet, color: 'from-amber-500 to-amber-700', desc: 'مراجعة وصرف طلبات السحب من البائعين' },
  ]

  return (
    <div className="space-y-5">
      {/* Total banner */}
      <div className={`rounded-2xl border p-4 ${data.total === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${data.total === 0 ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className={`text-lg font-extrabold ${data.total === 0 ? 'text-emerald-800' : 'text-amber-900'}`}>
              {data.total === 0 ? 'لا توجد طلبات بانتظار المراجعة' : `${data.total} طلب بانتظار المراجعة`}
            </div>
            <div className="text-sm text-gray-600">
              {data.total === 0 ? 'كل الطلبات تم البت فيها' : 'يرجى مراجعتها في أقرب وقت'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className={`bg-gradient-to-bl ${s.color} px-5 py-4 text-white`}>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-white/15 p-2">
                  <s.Icon className="h-5 w-5" />
                </span>
                <div className="text-3xl font-extrabold">{s.count}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-bold text-[#1B3A6B]">{s.label}</div>
                <p className="mt-0.5 text-xs text-gray-500">{s.desc}</p>
              </div>
              <ArrowLeft className="h-4 w-4 text-gray-400 transition group-hover:translate-x-[-3px] group-hover:text-[#1B3A6B]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
