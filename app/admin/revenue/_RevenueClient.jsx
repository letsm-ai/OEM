'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { Loader2, AlertCircle, Wallet, TrendingUp, Crown, Sparkles, GraduationCap } from 'lucide-react'
import { SkeletonStats } from '@/components/Skeleton'

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const TIER_LABEL = { FREE: 'مجاني', BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }
const TIER_COLOR = { FREE: '#9CA3AF', BASIC: '#60A5FA', GOLD: '#C9A84C', PLATINUM: '#7C3AED' }
const fmtOMR = (n) => new Intl.NumberFormat('ar', { maximumFractionDigits: 2 }).format(n || 0)

export default function RevenueClient() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'خطأ')
        return j
      })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonStats count={3} />
  if (err) return <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><AlertCircle className="h-5 w-5" /> {err}</div>
  if (!data) return null

  const monthly = (data.monthly || []).map((m) => ({
    ...m,
    label: `${AR_MONTHS[(m.month - 1) % 12]} ${String(m.year).slice(2)}`,
    total: (m.membershipRevenue || 0) + (m.consultationRevenue || 0),
  }))
  const tierBreakdown = (data.memberships?.byTier || []).map((r) => ({
    name: TIER_LABEL[r.tier] || r.tier,
    key: r.tier,
    revenue: r.revenue || 0,
    count: r.count || 0,
  }))
  const totalMembership = data.memberships?.totalRevenue || 0
  const totalConsultations = data.consultations?.totalRevenue || 0
  const grandTotal = totalMembership + totalConsultations

  // Current month
  const cm = monthly[monthly.length - 1] || { total: 0, membershipRevenue: 0, consultationRevenue: 0 }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard icon={<Wallet className="h-5 w-5" />} label="إجمالي الإيرادات" value={`${fmtOMR(grandTotal)} ر.ع`} sub="عضويات + استشارات" color="from-[#1B3A6B] to-[#0f2348]" />
        <KpiCard icon={<Sparkles className="h-5 w-5" />} label="إيرادات هذا الشهر" value={`${fmtOMR(cm.total)} ر.ع`} sub={`${fmtOMR(cm.membershipRevenue)} عضويات + ${fmtOMR(cm.consultationRevenue)} استشارات`} color="from-[#C9A84C] to-[#a78a38]" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="إيرادات الاستشارات الكلية" value={`${fmtOMR(totalConsultations)} ر.ع`} sub={`${data.consultations?.completedCount || 0} جلسة مكتملة`} color="from-emerald-500 to-emerald-700" />
      </div>

      {/* Monthly stacked area */}
      <ChartCard title="الإيرادات الشهرية" subtitle="عضويات + استشارات (آخر 12 شهراً) - بالريال العماني" icon={<TrendingUp className="h-5 w-5" />}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="consGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B3A6B" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#1B3A6B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
            <YAxis stroke="#6B7280" fontSize={11} />
            <Tooltip formatter={(v, n) => [`${fmtOMR(v)} ر.ع`, n]} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="membershipRevenue" name="العضويات" stackId="1" stroke="#C9A84C" fill="url(#memGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="consultationRevenue" name="الاستشارات" stackId="1" stroke="#1B3A6B" fill="url(#consGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Breakdown by tier */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="الإيرادات حسب باقة العضوية" subtitle="إجمالي المبيعات لكل باقة" icon={<Crown className="h-5 w-5" />}>
          {tierBreakdown.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">لا توجد عضويات مدفوعة بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tierBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip formatter={(v, n) => n === 'الإيرادات' ? [`${fmtOMR(v)} ر.ع`, n] : [v, n]} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="عدد الاشتراكات" fill="#60A5FA" radius={[6, 6, 0, 0]} />
                <Bar dataKey="revenue" name="الإيرادات" fill="#C9A84C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="توزيع الإيرادات" subtitle="المصدر الرئيسي للدخل" icon={<Wallet className="h-5 w-5" />}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: 'عضويات', value: totalMembership, color: '#C9A84C' },
                  { name: 'استشارات', value: totalConsultations, color: '#1B3A6B' },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label={(e) => `${e.name} (${fmtOMR(e.value)} ر.ع)`}
                labelLine={false}
                stroke="#fff"
                strokeWidth={2}
              >
                <Cell fill="#C9A84C" />
                <Cell fill="#1B3A6B" />
              </Pie>
              <Tooltip formatter={(v) => `${fmtOMR(v)} ر.ع`} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Experts table */}
      <ChartCard title="أفضل الخبراء (مساهمة بالإيرادات)" subtitle="حسب التقييم وعدد الجلسات" icon={<GraduationCap className="h-5 w-5" />}>
        {(!data.topExperts || data.topExperts.length === 0) ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">لا توجد بيانات بعد</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.topExperts.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B3A6B]/10 text-xs font-bold text-[#1B3A6B]">{i + 1}</div>
                  <div>
                    <div className="text-sm font-semibold text-[#1B3A6B]">{e.name}</div>
                    <div className="text-[11px] text-gray-500">{e.specialtyAr || e.specialty}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-[#C9A84C]">★ {(e.rating || 0).toFixed(1)}</div>
                  <div className="text-[11px] text-gray-500">{e.totalSessions || 0} جلسة</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-bl ${color} px-5 py-4 text-white`}>
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-white/15 p-1.5">{icon}</span>
          <span className="text-[11px] opacity-80">{label}</span>
        </div>
        <div className="mt-3 text-2xl font-extrabold leading-none">{value}</div>
        {sub && <div className="mt-1.5 text-[11px] opacity-90">{sub}</div>}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, icon, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">{icon}{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, padding: '6px 10px', direction: 'rtl' }
