import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Expert, Appointment, Availability } from '@/lib/models'
import { specialtyLabel } from '@/lib/experts'
import AvailabilityEditor from './_AvailabilityEditor'
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  User as UserIcon,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpertDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/expert')
  await connectDB()

  const expert = await Expert.findOne({ userId: session.user.id }).lean()
  if (!expert) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#1B3A6B]">لست خبيراً بعد</h1>
        <p className="mt-2 text-sm text-gray-600">
          سجّل نفسك كخبير استشاري لتظهر لك هذه اللوحة.
        </p>
        <a
          href="/consultations/become-expert"
          className="mt-4 inline-flex rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white"
        >
          انضم كخبير
        </a>
      </div>
    )
  }

  const availability = await Availability.find({ expertId: expert._id })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()

  const now = new Date()
  const upcoming = await Appointment.find({
    expertId: expert._id,
    status: { $in: ['CONFIRMED', 'PENDING'] },
    date: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  })
    .sort({ date: 1, startTime: 1 })
    .limit(20)
    .lean()

  const completed = await Appointment.find({
    expertId: expert._id,
    status: { $in: ['CONFIRMED', 'COMPLETED'] },
    date: { $lt: now },
  })
    .sort({ date: -1 })
    .lean()

  const totalEarnings = [...upcoming, ...completed]
    .filter((a) => ['CONFIRMED', 'COMPLETED'].includes(a.status))
    .reduce((sum, a) => sum + (a.totalPaid || 0), 0)

  const stats = [
    {
      icon: Calendar,
      label: 'مواعيد قادمة',
      value: upcoming.length,
    },
    {
      icon: CheckCircle2,
      label: 'جلسات مكتملة',
      value: completed.length,
    },
    {
      icon: DollarSign,
      label: 'إجمالي الإيرادات',
      value: `${totalEarnings.toFixed(2)} ر.ع`,
    },
  ]

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-6 text-white">
        <div className="flex items-center gap-4">
          <UserIcon className="h-6 w-6 text-[#C9A84C]" />
          <div>
            <div className="text-sm text-gray-300">لوحة الخبير</div>
            <h1 className="text-2xl font-bold">{specialtyLabel(expert.specialty)}</h1>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            <div className="mt-2 text-2xl font-extrabold text-[#1B3A6B]">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-[#1B3A6B]">
          جدولي الأسبوعي
        </h2>
        <AvailabilityEditor initial={availability} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-[#1B3A6B]">
          المواعيد القادمة
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            لا توجد مواعيد قادمة
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <div
                key={a._id}
                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar className="h-4 w-4 text-[#1B3A6B]" />
                    {new Intl.DateTimeFormat('ar', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    }).format(new Date(a.date))}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-3.5 w-3.5" />
                    {a.startTime} - {a.endTime}
                  </div>
                </div>
                <div className="text-left">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === 'CONFIRMED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {a.status === 'CONFIRMED' ? 'مؤكد' : 'معلّق'}
                  </span>
                  <div className="mt-1 text-xs font-semibold text-[#1B3A6B]">
                    {a.totalPaid} ر.ع
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
