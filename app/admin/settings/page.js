import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SettingsClient from './_SettingsClient'
import { Sliders } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'إعدادات الموقع — أدمن' }

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/settings')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
        <p className="mt-2 text-sm text-gray-600">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    )
  }
  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            <Sliders className="h-4 w-4" /> إعدادات متقدمة
          </div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            إعدادات الموقع
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            تحكّم في أسعار الباقات، وضع المجانية الشامل، والتجربة المجانية دون لمس الكود.
          </p>
        </div>
        <SettingsClient />
      </div>
    </div>
  )
}
