import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Appointment, Expert, User } from '@/lib/models'
import MyBookingsClient from './_MyBookingsClient'
import { CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/consultations/my-bookings')

  await connectDB()
  const appts = await Appointment.find({ clientId: session.user.id })
    .sort({ date: -1, startTime: -1 })
    .lean()

  const expertIds = Array.from(new Set(appts.map((a) => a.expertId)))
  const experts = await Expert.find({ _id: { $in: expertIds } })
    .select({ _id: 1, userId: 1, specialtyAr: 1, photo: 1 })
    .lean()
  const expertUserIds = experts.map((e) => e.userId)
  const users = await User.find({ _id: { $in: expertUserIds } })
    .select({ _id: 1, name: 1 })
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
  const expertMap = Object.fromEntries(
    experts.map((e) => [
      e._id,
      {
        ...e,
        name: userMap[e.userId]?.name || 'خبير',
      },
    ])
  )

  const enriched = appts.map((a) => ({
    ...a,
    id: a._id,
    expert: expertMap[a.expertId] || null,
    date: a.date ? new Date(a.date).toISOString() : null,
  }))

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays className="h-4 w-4" />
          حجوزاتي
        </div>
        <h1 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">الاستشارات</h1>
      </div>
      <MyBookingsClient appointments={enriched} />
    </div>
  )
}
