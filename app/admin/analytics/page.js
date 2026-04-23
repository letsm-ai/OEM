import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Shield, BarChart3 } from 'lucide-react'
import AnalyticsClient from './_AnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/analytics')
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

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-[#1B3A6B]" />
          <div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
              لوحة الإحصائيات
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              نظرة عامة على أداء المنصة
            </p>
          </div>
        </div>
        <AnalyticsClient />
      </div>
    </div>
  )
}
