import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Expert, User } from '@/lib/models'
import { specialtyLabel } from '@/lib/experts'
import { STATUS_LABELS, STATUS_BADGE } from '@/lib/directory'
import AdminExpertActions from './_AdminExpertActions'
import { Shield, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminExpertsPage({ searchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/experts')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
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
  const experts = await Expert.find(query).sort({ createdAt: -1 }).lean()
  const userIds = experts.map((e) => e.userId)
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, name: 1, email: 1 })
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]))

  const tabs = [
    { key: 'PENDING', label: 'قيد المراجعة', icon: Clock },
    { key: 'APPROVED', label: 'معتمدون', icon: CheckCircle2 },
    { key: 'REJECTED', label: 'مرفوضون', icon: XCircle },
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
          مراجعة طلبات الخبراء
        </h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/experts?status=${t.key}`}
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

      {experts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">لا يوجد خبراء في هذه الفئة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {experts.map((e) => {
            const owner = userMap[e.userId]
            return (
              <div
                key={e._id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {e.photo ? (
                    <img
                      src={e.photo}
                      className="h-16 w-16 rounded-full border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3A6B]/5 text-xl font-bold text-[#1B3A6B]">
                      {owner?.name?.charAt(0) || 'خ'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#1B3A6B]">
                        {owner?.name || 'خبير'}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[e.status]
                        }`}
                      >
                        {STATUS_LABELS[e.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>التخصص: <strong>{specialtyLabel(e.specialty)}</strong></span>
                      <span>السعر: <strong>{e.hourlyRate} ر.ع/ساعة</strong></span>
                      {e.experienceYears > 0 && (
                        <span>الخبرة: <strong>{e.experienceYears} سنة</strong></span>
                      )}
                      {owner && (
                        <span dir="ltr" className="text-gray-400">{owner.email}</span>
                      )}
                    </div>
                    {e.bio && (
                      <p className="mt-3 text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{e.bio}</p>
                    )}
                    {e.cv && (
                      <a
                        href={e.cv}
                        download={`cv-${e._id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1B3A6B] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        تحميل السيرة الذاتية
                      </a>
                    )}
                    {e.rejectionReason && (
                      <div className="mt-2 text-xs text-red-700">
                        سبب الرفض: {e.rejectionReason}
                      </div>
                    )}
                  </div>
                  <AdminExpertActions expertId={e._id} currentStatus={e.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
