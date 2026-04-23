import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import SettingsClient from './_SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/settings')

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (!user) redirect('/login')

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            إعدادات الحساب
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة معلوماتك الشخصية وكلمة المرور وإعدادات الحساب
          </p>
        </div>

        <SettingsClient
          initial={{
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            photo: user.photo || '',
            role: user.role,
          }}
        />
      </div>
    </div>
  )
}
