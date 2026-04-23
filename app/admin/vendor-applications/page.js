import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AdminVendorAppsClient from './_AdminVendorAppsClient'
import { Shield, Briefcase } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminVendorAppsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/vendor-applications')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
      </div>
    )
  }
  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-6 flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-[#1B3A6B]" />
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">طلبات البائعين</h1>
        </div>
        <AdminVendorAppsClient />
      </div>
    </div>
  )
}
