import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, VendorApplication } from '@/lib/models'
import Link from 'next/link'
import { Sparkles, Store, Hourglass, XCircle } from 'lucide-react'
import VendorDashboardClient from './_VendorDashboardClient'
import VendorApplyFormClient from './_VendorApplyFormClient'

export const dynamic = 'force-dynamic'

export default async function VendorDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/dashboard/vendor')
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  const isVendor = user?.role === 'VENDOR' || user?.role === 'ADMIN'
  const tier = user?.membershipTier || 'FREE'
  const canApply = ['GOLD', 'PLATINUM'].includes(tier)

  if (isVendor) {
    return <VendorDashboardClient />
  }

  const app = await VendorApplication.findOne({ userId: session.user.id }).lean()

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-6 w-6 text-[#1B3A6B]" />
          <h1 className="text-2xl font-extrabold text-[#1B3A6B]">
            كن بائعاً في مجلس الرواد
          </h1>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          قم ببيع منتجاتك عبر المتجر الإلكتروني واستفد من شبكة رواد الأعمال العمانيين.
        </p>

        {app?.status === 'PENDING' && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <Hourglass className="h-4 w-4" /> طلبك قيد المراجعة
            </div>
            <div>
              اسم المتجر: <b>{app.businessName}</b>
            </div>
            <div className="mt-1">
              سيتم مراجعة طلبك وإشعارك بالنتيجة قريباً.
            </div>
          </div>
        )}
        {app?.status === 'REJECTED' && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <XCircle className="h-4 w-4" /> تم رفض الطلب
            </div>
            {app.adminNote ? (
              <div className="mt-1">{app.adminNote}</div>
            ) : (
              <div className="mt-1">يمكنك التقديم مجدداً بعد التحسين.</div>
            )}
          </div>
        )}

        {!canApply ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Sparkles className="inline-block h-4 w-4" /> تحتاج إلى عضوية{' '}
            <b>ذهبية</b> أو <b>بلاتينية</b> للتقديم كبائع.{' '}
            <Link
              href="/membership"
              className="me-1 font-bold underline"
            >
              ترقية العضوية
            </Link>
          </div>
        ) : (
          (!app || app.status === 'REJECTED') && <VendorApplyFormClient />
        )}
      </div>
    </div>
  )
}
