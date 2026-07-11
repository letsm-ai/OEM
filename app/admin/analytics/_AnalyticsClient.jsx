'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  UserPlus,
  Wallet,
  Sparkles,
  Star,
  CalendarCheck2,
  Clock,
  TrendingUp,
  Loader2,
  Crown,
  AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts'

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const TIER_LABEL = { FREE: 'مجاني', BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }
const TIER_COLOR = {
  FREE: '#9CA3AF',
  BASIC: '#60A5FA',
  GOLD: '#C9A84C',
  PLATINUM: '#7C3AED',
}
const ROLE_LABEL = {
  ADMIN: 'مسؤول',
  MEMBER: 'عضو',
  VENDOR: 'بائع',
  EXPERT: 'خبير',
}

const fmtOMR = (n) =>
  new Intl.NumberFormat('ar', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0)

const fmtInt = (n) =>
  new Intl.NumberFormat('ar', { maximumFractionDigits: 0 }).format(n || 0)

export default function AnalyticsClient() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/analytics')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || 'خطأ')
        return j
      })
      .then((j) => {
        if (!cancelled) setData(j)
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'تعذر تحميل البيانات')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A6B]" />
      </div>
    )
  }
  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <AlertCircle className="h-5 w-5" />
        {err}
      </div>
    )
  }
  if (!data) return null

  const monthly = (data.monthly || []).map((m) => ({
    ...m,
    label: `${AR_MONTHS[(m.month - 1) % 12]} ${String(m.year).slice(2)}`,
  }))

  const byRole = Object.entries(data.users.byRole || {}).map(([k, v]) => ({
    role: ROLE_LABEL[k] || k,
    key: k,
    count: v,
  }))
  const byTier = Object.entries(data.users.byTier || {}).map(([k, v]) => ({
    name: TIER_LABEL[k] || k,
    key: k,
    value: v,
  }))
  const paidByTier = (data.memberships.byTier || []).map((r) => ({
    name: TIER_LABEL[r.tier] || r.tier,
    key: r.tier,
    count: r.count,
    revenue: r.revenue,
  }))

  const totalRevenue =
    (data.memberships.totalRevenue || 0) +
    (data.consultations.totalRevenue || 0)

  return (
    <div className="space-y-6">
      {/* Pending alerts */}
      {(data.pending.companies > 0 || data.pending.experts > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock className="h-5 w-5 text-amber-600" />
          <span className="font-semibold">طلبات بانتظار المراجعة:</span>
          {data.pending.companies > 0 && (
            <a
              href="/admin/companies?status=PENDING"
              className="rounded-full bg-white px-3 py-1 font-semibold text-amber-800 underline-offset-2 hover:underline"
            >
              {fmtInt(data.pending.companies)} شركة
            </a>
          )}
          {data.pending.experts > 0 && (
            <a
              href="/admin/experts?status=PENDING"
              className="rounded-full bg-white px-3 py-1 font-semibold text-amber-800 underline-offset-2 hover:underline"
            >
              {fmtInt(data.pending.experts)} خبير
            </a>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="إجمالي المستخدمين"
          value={fmtInt(data.users.total)}
          sub={`+${fmtInt(data.users.last30Days)} خلال 30 يوماً`}
          color="from-blue-500 to-blue-700"
        />
        <KpiCard
          icon={<Sparkles className="h-5 w-5" />}
          label="العضويات المباعة"
          value={fmtInt(data.memberships.totalSold)}
          sub={`${fmtOMR(data.memberships.totalRevenue)} ر.ع`}
          color="from-[#C9A84C] to-[#a78a38]"
        />
        <KpiCard
          icon={<CalendarCheck2 className="h-5 w-5" />}
          label="إيرادات الاستشارات"
          value={`${fmtOMR(data.consultations.totalRevenue)} ر.ع`}
          sub={`${fmtInt(
            data.consultations.completedCount + data.consultations.confirmedCount
          )} جلسة`}
          color="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="إجمالي الإيرادات"
          value={`${fmtOMR(totalRevenue)} ر.ع`}
          sub="عضويات + استشارات"
          color="from-[#1B3A6B] to-[#0f2348]"
        />
      </div>

      {/* Diagnostic: shown only when membership revenue is unexpectedly zero */}
      {data.memberships.totalSold === 0 && Array.isArray(data.memberships.diagnostic) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              !
            </div>
            <div className="flex-1">
              <div className="font-bold text-amber-900">
                لا توجد اشتراكات مدفوعة مسجّلة بعد
              </div>
              <p className="mt-1 text-sm text-amber-800">
                إذا كنت تتوقّع ظهور إيرادات هنا، تحقّق من حالة كل اشتراك في قاعدة
                البيانات. يجب أن يكون <code className="rounded bg-white px-1 py-0.5 text-[11px] font-mono">paymentStatus = &quot;PAID&quot;</code>{' '}
                (أو <code className="rounded bg-white px-1 py-0.5 text-[11px] font-mono">amountPaid &gt; 0</code>).
              </p>
              {data.memberships.diagnostic.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-50 text-right text-amber-800">
                        <th className="px-3 py-2">الحالة</th>
                        <th className="px-3 py-2 text-center">العدد</th>
                        <th className="px-3 py-2 text-center">المبلغ (ر.ع)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.memberships.diagnostic.map((row) => (
                        <tr key={row.status} className="border-t border-amber-100">
                          <td className="px-3 py-2 font-mono">{row.status}</td>
                          <td className="px-3 py-2 text-center">{row.count}</td>
                          <td className="px-3 py-2 text-center">
                            {fmtOMR(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-700">
                  لا يوجد أي سجلّ اشتراك في قاعدة البيانات على الإطلاق.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly revenue area chart */}
      <ChartCard
        title="الإيرادات الشهرية"
        subtitle="العضويات والاستشارات خلال آخر 12 شهراً (ر.ع)"
        icon={<TrendingUp className="h-5 w-5" />}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="consGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B3A6B" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#1B3A6B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
            <YAxis stroke="#6B7280" fontSize={11} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, n) => [`${fmtOMR(v)} ر.ع`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="membershipRevenue"
              name="العضويات"
              stroke="#C9A84C"
              fill="url(#memGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="consultationRevenue"
              name="الاستشارات"
              stroke="#1B3A6B"
              fill="url(#consGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Signups + Memberships (two line chart) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="التسجيلات الشهرية"
          subtitle="عدد المستخدمين الجدد لكل شهر"
          icon={<UserPlus className="h-5 w-5" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="signups"
                name="التسجيلات"
                stroke="#1B3A6B"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="العضويات الشهرية"
          subtitle="عدد الاشتراكات المباعة"
          icon={<Sparkles className="h-5 w-5" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="label" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="memberships"
                name="العضويات"
                fill="#C9A84C"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Users by Tier (pie) + Role breakdown (bar) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="المستخدمون حسب الباقة"
          subtitle="توزيع الأعضاء على باقات العضوية"
          icon={<Crown className="h-5 w-5" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byTier}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label={(e) => `${e.name} (${e.value})`}
                labelLine={false}
                stroke="#fff"
                strokeWidth={2}
              >
                {byTier.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={TIER_COLOR[entry.key] || '#9CA3AF'}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="المستخدمون حسب الدور"
          subtitle="أعضاء، خبراء، بائعون، ومسؤولون"
          icon={<Users className="h-5 w-5" />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={byRole}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" stroke="#6B7280" fontSize={11} allowDecimals={false} />
              <YAxis
                dataKey="role"
                type="category"
                stroke="#6B7280"
                fontSize={12}
                width={60}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="count"
                name="العدد"
                fill="#1B3A6B"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Membership revenue by tier + top experts */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ChartCard
          title="إيرادات العضويات حسب الباقة"
          subtitle="إجمالي المبيعات لكل باقة (ر.ع)"
          icon={<Wallet className="h-5 w-5" />}
        >
          {paidByTier.length === 0 ? (
            <EmptyHint text="لا توجد عضويات مدفوعة حتى الآن" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={paidByTier}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, n) => {
                    if (n === 'الإيرادات') return [`${fmtOMR(v)} ر.ع`, n]
                    return [fmtInt(v), n]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="count"
                  name="عدد الاشتراكات"
                  fill="#60A5FA"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="revenue"
                  name="الإيرادات"
                  fill="#C9A84C"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="أفضل الخبراء"
          subtitle="حسب التقييم وعدد الجلسات"
          icon={<Star className="h-5 w-5" />}
        >
          {(!data.topExperts || data.topExperts.length === 0) ? (
            <EmptyHint text="لا توجد بيانات خبراء بعد" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.topExperts.map((e, i) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B3A6B]/10 text-xs font-bold text-[#1B3A6B]">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#1B3A6B]">
                        {e.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {e.specialtyAr || e.specialty}
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="inline-flex items-center gap-1 text-sm font-bold text-[#C9A84C]">
                      <Star className="h-3.5 w-3.5 fill-[#C9A84C]" />
                      {(e.rating || 0).toFixed(1)}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {fmtInt(e.totalSessions)} جلسة
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <p className="text-center text-[11px] text-gray-400">
        تم التحديث: {new Intl.DateTimeFormat('ar', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(data.generatedAt))}
      </p>
    </div>
  )
}

/* ----- components ----- */
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
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">
            {icon}
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyHint({ text }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
      {text}
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
  direction: 'rtl',
}
