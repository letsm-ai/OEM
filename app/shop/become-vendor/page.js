import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import UpgradePrompt from '@/components/UpgradePrompt'
import { canBeVendor, VENDOR_MIN_TIER } from '@/lib/membership'
import { Store, CheckCircle2 } from 'lucide-react'

export default async function BecomeVendorPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/shop/become-vendor')
  }

  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  const tier = dbUser?.membershipTier || 'FREE'

  if (!canBeVendor(tier)) {
    return (
      <div className="container mx-auto px-4 py-12">
        <UpgradePrompt
          requiredTier={VENDOR_MIN_TIER}
          currentTier={tier}
          featureAr="فتح متجر بائع"
          descriptionAr="لتتمكن من إدراج منتجاتك وبيعها لأعضاء المجلس تحتاج للاشتراك في الباقة الذهبية، التي تمنحك أيضاً خصم 20% على الاستشارات وأولوية في دليل الشركات."
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-[#C9A84C]/40 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#C9A84C]/20">
            <Store className="h-6 w-6 text-[#8a6f2d]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1B3A6B]">فتح متجر بائع</h1>
            <p className="text-sm text-gray-500">متاح لباقتك الحالية ✓</p>
          </div>
        </div>
        <div className="space-y-3 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">تهانينا! يحق لك فتح متجر بائع.</span>
          </div>
          <p className="text-xs">
            سيتم فتح باب تسجيل المتجر وإضافة المنتجات في المرحلة الثالثة (المتجر).
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-6 block w-full rounded-lg bg-[#1B3A6B] py-2.5 text-center text-sm font-semibold text-white hover:bg-[#152c52]"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  )
}
