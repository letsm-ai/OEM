import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OptOutClient from './_OptOutClient'
import { Shield, MailX } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'إلغاء الاشتراك في الإيميل — أدمن',
}

export default async function EmailOptOutsAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/email-optouts')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
        <p className="mt-2 text-sm text-gray-600">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            <MailX className="h-4 w-4" /> قائمة إلغاء الاشتراك
          </div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            إدارة إلغاء الاشتراك في الإيميل
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            المستخدمون الذين ألغوا الاشتراك من الرسائل الترويجية (رسائل الحساب الأساسية تستمر)
          </p>
        </div>

        <OptOutClient />
      </div>
    </div>
  )
}
