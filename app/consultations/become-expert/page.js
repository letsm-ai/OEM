import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Expert } from '@/lib/models'
import { tierAtLeast } from '@/lib/membership'
import UpgradePrompt from '@/components/UpgradePrompt'
import BecomeExpertForm from './_BecomeExpertForm'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/directory'

export const dynamic = 'force-dynamic'

export default async function BecomeExpertPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/consultations/become-expert')

  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  const tier = dbUser?.membershipTier || 'FREE'

  if (!tierAtLeast(tier, 'GOLD')) {
    return (
      <div className="container mx-auto px-4 py-12">
        <UpgradePrompt
          requiredTier="GOLD"
          currentTier={tier}
          featureAr="تسجيل خبير استشاري"
          descriptionAr="لتسجيل نفسك كخبير استشاري وتقديم جلسات مدفوعة لأعضاء المجلس تحتاج الباقة الذهبية أو البلاتينية. ستمر طلبات الخبراء بمراجعة الإدارة قبل الظهور في القائمة."
        />
      </div>
    )
  }

  const existing = await Expert.findOne({ userId: session.user.id }).lean()

  if (existing) {
    const status = existing.status
    const statusIcon =
      status === 'APPROVED' ? (
        <CheckCircle2 className="h-6 w-6 text-green-600" />
      ) : status === 'REJECTED' ? (
        <XCircle className="h-6 w-6 text-red-600" />
      ) : (
        <Clock className="h-6 w-6 text-yellow-600" />
      )
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            {statusIcon}
            <div>
              <h1 className="text-xl font-bold text-[#1B3A6B]">
                طلبك كخبير: {STATUS_LABELS[status]}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                تخصص: {existing.specialtyAr}
              </p>
            </div>
          </div>
          {status === 'REJECTED' && existing.rejectionReason && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              سبب الرفض: {existing.rejectionReason}
            </div>
          )}
          {status === 'APPROVED' && (
            <p className="text-sm text-gray-600">
              تهانينا! يمكنك إدارة مواعيدك وحجوزاتك من لوحة الخبير.
            </p>
          )}
          {status === 'PENDING' && (
            <p className="text-sm text-gray-600">
              طلبك قيد المراجعة. سنبلّغك فور اعتماده.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">
          انضم إلينا كخبير استشاري
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          سيمر طلبك بمراجعة الإدارة قبل ظهورك في قائمة الخبراء.
        </p>
      </div>
      <BecomeExpertForm />
    </div>
  )
}
