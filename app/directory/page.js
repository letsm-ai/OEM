import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { Briefcase, Plus, ArrowLeft } from 'lucide-react'
import { canListCompany, TIER_META } from '@/lib/membership'

export default async function DirectoryPage() {
  const session = await getServerSession(authOptions)
  let tier = 'FREE'
  if (session?.user) {
    await connectDB()
    const u = await User.findById(session.user.id).lean()
    tier = u?.membershipTier || 'FREE'
  }
  const mayList = canListCompany(tier)

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3A6B]/10">
          <Briefcase className="h-8 w-8 text-[#1B3A6B]" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
          دليل الشركات
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          تصفح شركات رواد الأعمال العمانيين — سيفعل الدليل الكامل في المرحلة الثالثة.
        </p>

        <Link
          href="/directory/add-company"
          className="group mx-auto mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#152c52]"
        >
          <Plus className="h-4 w-4" />
          أضف شركتك للدليل
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="mt-2 text-xs text-gray-500">
          {mayList
            ? `متاح لباقة ${TIER_META[tier].nameAr}`
            : 'يتطلب باقة أساسي أو أعلى'}
        </div>
      </div>
    </div>
  )
}
