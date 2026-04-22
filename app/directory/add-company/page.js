import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { canListCompany, DIRECTORY_MIN_TIER } from '@/lib/membership'
import UpgradePrompt from '@/components/UpgradePrompt'
import AddCompanyForm from './_AddCompanyForm'

export default async function AddCompanyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/directory/add-company')
  }
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  const tier = dbUser?.membershipTier || 'FREE'

  if (!canListCompany(tier)) {
    return (
      <div className="container mx-auto px-4 py-12">
        <UpgradePrompt
          requiredTier={DIRECTORY_MIN_TIER}
          currentTier={tier}
          featureAr="إضافة شركتك للدليل"
          descriptionAr="لاستعراض شركتك في دليل رواد الأعمال العمانيين يكفي الاشتراك في الباقة الأساسية — ستحصل أيضاً على خصم 10% على المتجر والاستشارات."
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">
          إضافة شركة جديدة
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          ستمر الشركة بمراجعة الإدارة قبل عرضها في الدليل العام.
        </p>
      </div>
      <AddCompanyForm />
    </div>
  )
}
