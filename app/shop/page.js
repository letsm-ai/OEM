import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { ShoppingBag, Store, Percent, ArrowLeft } from 'lucide-react'
import { TIER_DISCOUNT, TIER_META, canBeVendor } from '@/lib/membership'

export default async function ShopPage() {
  const session = await getServerSession(authOptions)
  let tier = 'FREE'
  if (session?.user) {
    await connectDB()
    const u = await User.findById(session.user.id).lean()
    tier = u?.membershipTier || 'FREE'
  }
  const discount = TIER_DISCOUNT[tier]
  const mayVendor = canBeVendor(tier)

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3A6B]/10">
          <ShoppingBag className="h-8 w-8 text-[#1B3A6B]" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
          متجر المجلس
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          سيطلق المتجر في المرحلة الثالثة ويضم منتجات من رواد أعمال عمانيين.
        </p>

        {/* Discount banner */}
        {discount > 0 ? (
          <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-5 py-2 text-sm font-semibold text-green-800">
            <Percent className="h-4 w-4" />
            خصم باقة {TIER_META[tier].nameAr}: {discount}% على كل المشتريات
          </div>
        ) : (
          <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-600">
            <Percent className="h-4 w-4" />
            اشترك في باقة لتحصل على خصم تلقائي
          </div>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/shop/become-vendor"
            className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 text-right transition hover:border-[#C9A84C] hover:shadow-md"
          >
            <div>
              <div className="flex items-center gap-2 text-[#1B3A6B]">
                <Store className="h-5 w-5" />
                <span className="font-bold">افتح متجر بائع</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {mayVendor
                  ? 'متاح لباقتك الذهبية / البلاتينية'
                  : 'يتطلب باقة ذهبي أو أعلى'}
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-[#C9A84C]" />
          </Link>

          <Link
            href="/membership"
            className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 text-right transition hover:border-[#C9A84C] hover:shadow-md"
          >
            <div>
              <div className="flex items-center gap-2 text-[#1B3A6B]">
                <Percent className="h-5 w-5" />
                <span className="font-bold">شاهد خصومات الأعضاء</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                ترقِّ ووفّر على جميع المشتريات والاستشارات
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-[#C9A84C]" />
          </Link>
        </div>
      </div>
    </div>
  )
}
