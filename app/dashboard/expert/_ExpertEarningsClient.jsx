'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  Wallet,
  Users,
  Percent,
  TrendingUp,
  CalendarCheck,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react'

const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

const fmtOMR = (n) => `${(Number(n) || 0).toFixed(3)} ر.ع`

export default function ExpertEarningsClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/experts/me/earnings')
        const d = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(d.error || 'تعذّر تحميل بيانات الأرباح')
          setLoading(false)
          return
        }
        setData(d)
      } catch {
        if (!cancelled) setError('تعذّر الاتصال بالخادم')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A6B]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    )
  }

  const s = data.summary
  const monthly = data.monthly || []

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="إجمالي الجلسات"
          value={s.sessions}
          sub={`${s.completedSessions} مكتملة`}
          accent="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="إجمالي الدخل (قبل العمولة)"
          value={fmtOMR(s.gross)}
          sub="المبلغ المدفوع من العملاء"
          accent="indigo"
        />
        <StatCard
          icon={Percent}
          label={`عمولة المنصّة (${s.commissionPercent}%)`}
          value={fmtOMR(s.commission)}
          sub="مستحقة للمنصّة"
          accent="amber"
        />
        <StatCard
          icon={Wallet}
          label="صافي أرباحك"
          value={fmtOMR(s.net)}
          sub="بعد خصم العمولة"
          accent="emerald"
          bold
        />
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
        ℹ️ وفق عقد الخبير الموقّع، تخصم المنصّة <strong>{s.commissionPercent}%</strong> من قيمة كل جلسة استشارية. تُحوّل المستحقّات الصافية إلى حسابك البنكي بشكل شهري.
      </div>

      {/* Monthly breakdown */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-[#F8F9FA] px-4 py-3">
          <h2 className="text-sm font-bold text-[#1B3A6B]">تفصيل شهري (آخر 12 شهر)</h2>
        </div>
        {monthly.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">لم تحجز أي جلسة بعد. أرباحك ستظهر هنا فور حجز أول استشارة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#FAFAFA] text-xs font-bold text-gray-600">
                <tr>
                  <th className="px-4 py-3">الشهر</th>
                  <th className="px-4 py-3">الجلسات</th>
                  <th className="px-4 py-3">الدخل (إجمالي)</th>
                  <th className="px-4 py-3">العمولة</th>
                  <th className="px-4 py-3">الصافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthly.map((m) => (
                  <tr key={`${m.year}-${m.month}`} className="hover:bg-[#F8F9FA]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#1B3A6B]">
                      {MONTHS_AR[m.month - 1]} {m.year}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        <Users className="h-3 w-3" /> {m.sessions}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtOMR(m.gross)}</td>
                    <td className="px-4 py-3 text-amber-700">-{fmtOMR(m.commission)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{fmtOMR(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent = 'blue', bold = false }) {
  const map = {
    blue: 'from-blue-500 to-blue-700',
    indigo: 'from-indigo-500 to-indigo-700',
    amber: 'from-amber-500 to-amber-700',
    emerald: 'from-emerald-500 to-emerald-700',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${map[accent]}`} />
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-bl ${map[accent]} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-semibold text-gray-500">{label}</div>
      </div>
      <div
        className={`text-2xl font-extrabold text-[#1B3A6B] ${bold ? 'text-emerald-700' : ''}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  )
}
