import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Company } from '@/lib/models'
import { STATUS_LABELS, STATUS_BADGE, sectorLabel } from '@/lib/directory'
import { Plus, AlertTriangle, Building2, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MyCompaniesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/directory/my-companies')

  await connectDB()
  const companies = await Company.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">
            شركاتي
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            إدارة بيانات شركتك ومتابعة حالة الاعتماد
          </p>
        </div>
        <Link
          href="/directory/add-company"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
        >
          <Plus className="h-4 w-4" />
          إضافة شركة جديدة
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-3 text-lg font-bold text-gray-700">لا توجد شركات بعد</h3>
          <p className="mt-1 text-sm text-gray-500">
            أضف شركتك لتظهر في دليل المجلس
          </p>
          <Link
            href="/directory/add-company"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            أضف شركتك الآن
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((c) => (
            <div
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                {c.logo ? (
                  <img
                    src={c.logo}
                    alt={c.nameAr}
                    className="h-14 w-14 rounded-xl border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1B3A6B]/5 text-xl font-bold text-[#1B3A6B]">
                    {c.nameAr?.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-[#1B3A6B]">{c.nameAr}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span>{sectorLabel(c.sector)}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[c.status]
                      }`}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  {c.status === 'REJECTED' && c.rejectionReason && (
                    <div className="mt-2 inline-flex items-start gap-1 rounded-lg bg-red-50 px-3 py-1 text-xs text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>سبب الرفض: {c.rejectionReason}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/directory/edit/${c._id}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  تعديل
                </Link>
                {c.status === 'APPROVED' && (
                  <Link
                    href={`/directory/${c._id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1B3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152c52]"
                  >
                    عرض
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
