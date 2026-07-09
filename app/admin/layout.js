import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Shield } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'لوحة الإدارة' }

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin')

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
    <AdminShell user={{ id: session.user.id, name: session.user.name, email: session.user.email }}>
      {children}
    </AdminShell>
  )
}
