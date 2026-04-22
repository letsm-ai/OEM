import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Company, User } from '@/lib/models'
import {
  STATUS_LABELS,
  STATUS_BADGE,
  sectorLabel,
  governorateLabel,
} from '@/lib/directory'
import AdminCompanyActions from './_AdminCompanyActions'
import { Shield, Clock, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminCompaniesPage({ searchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/companies')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
        <p className="mt-2 text-sm text-gray-600">
          هذه الصفحة مخصصة للمسؤولين فقط.
        </p>
      </div>
    )
  }

  const status = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(
    (searchParams?.status || '').toUpperCase()
  )
    ? searchParams.status.toUpperCase()
    : 'PENDING'

  await connectDB()
  const query = status === 'ALL' ? {} : { status }
  const companies = await Company.find(query)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()

  const userIds = Array.from(new Set(companies.map((c) => c.userId)))
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, name: 1, email: 1 })
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]))

  const tabs = [
    { key: 'PENDING', label: 'قيد المراجعة', icon: Clock },
    { key: 'APPROVED', label: 'معتمدة', icon: CheckCircle2 },
    { key: 'REJECTED', label: 'مرفوضة', icon: XCircle },
    { key: 'ALL', label: 'الكل' },
  ]

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="h-4 w-4" />
          لوحة الإدارة
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#1B3A6B] md:text-3xl">
          مراجعة الشركات
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/companies?status=${t.key}`}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              status === t.key
                ? 'border-[#C9A84C] text-[#1B3A6B]'
                : 'border-transparent text-gray-500 hover:text-[#1B3A6B]'
            }`}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </Link>
        ))}
      </div>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">لا توجد شركات في هذه الفئة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((c) => {
            const owner = userMap[c.userId]
            return (
              <div
                key={c._id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {c.logo ? (
                    <img
                      src={c.logo}
                      alt={c.nameAr}
                      className="h-16 w-16 rounded-xl border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#1B3A6B]/5 text-2xl font-bold text-[#1B3A6B]">
                      {c.nameAr?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#1B3A6B]">
                        {c.nameAr}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[c.status]
                        }`}
                      >
                        {STATUS_LABELS[c.status]}
                      </span>
                    </div>
                    {c.nameEn && (
                      <div dir="ltr" className="text-right text-xs text-gray-500">
                        {c.nameEn}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>القطاع: <strong>{sectorLabel(c.sector)}</strong></span>
                      {c.governorate && (
                        <span>المحافظة: <strong>{governorateLabel(c.governorate)}</strong></span>
                      )}
                      {owner && (
                        <span>
                          المالك: <strong>{owner.name}</strong>
                          <span dir="ltr" className="mr-1 text-gray-400">
                            ({owner.email})
                          </span>
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                        {c.description}
                      </p>
                    )}
                    {c.rejectionReason && (
                      <div className="mt-2 text-xs text-red-700">
                        سبب الرفض السابق: {c.rejectionReason}
                      </div>
                    )}
                  </div>
                  <AdminCompanyActions
                    companyId={c._id}
                    currentStatus={c.status}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
