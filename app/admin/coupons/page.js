import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import CouponsAdminClient from './_CouponsAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminCouponsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/coupons')
  }
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="mb-2 text-xl font-bold text-red-700">غير مصرح</h1>
          <p className="text-sm text-red-600">هذه الصفحة مخصصة للمسؤولين فقط.</p>
        </div>
      </div>
    )
  }
  return <CouponsAdminClient />
}
