import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Expert } from '@/lib/models'
import ExpertEarningsClient from './_ExpertEarningsClient'
import { GraduationCap } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'أرباحي — لوحة الخبير' }

export default async function ExpertEarningsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/dashboard/expert')

  await connectDB()
  const expert = await Expert.findOne({ userId: session.user.id }).lean()

  if (!expert) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <GraduationCap className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-[#1B3A6B]">لم تسجّل كخبير بعد</h1>
        <p className="mt-2 text-sm text-gray-600">
          لرؤية أرباحك وتقديم الاستشارات، يجب أولاً التسجيل كخبير استشاري (تتطلّب باقة ذهبية أو أعلى).
        </p>
        <Link
          href="/consultations/become-expert"
          className="mt-6 inline-block rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
        >
          التسجيل كخبير
        </Link>
      </div>
    )
  }

  if (expert.status !== 'APPROVED') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-[#1B3A6B]">حسابك كخبير قيد {expert.status === 'PENDING' ? 'المراجعة' : 'الرفض'}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {expert.status === 'PENDING'
            ? 'سنبلّغك فور اعتماد طلبك من الأدمن.'
            : 'reasons: ' + (expert.rejectionReason || '—')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            <GraduationCap className="h-4 w-4" /> لوحة الخبير
          </div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            أرباحي وجلساتي
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            تتبّع إيراداتك، عمولة المنصّة، وصافي مستحقاتك من جلسات الاستشارات.
          </p>
        </div>
        <ExpertEarningsClient />
      </div>
    </div>
  )
}
