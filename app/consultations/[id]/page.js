import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Expert, User } from '@/lib/models'
import { specialtyLabel } from '@/lib/experts'
import { TIER_DISCOUNT } from '@/lib/membership'
import BookingWidget from './_BookingWidget'
import { Star, Clock, Award, ArrowRight, Percent } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpertProfilePage({ params }) {
  await connectDB()
  const expert = await Expert.findById(params.id).lean()
  if (!expert || expert.status !== 'APPROVED') notFound()

  const user = await User.findById(expert.userId)
    .select({ name: 1 })
    .lean()

  const session = await getServerSession(authOptions)
  let clientTier = 'FREE'
  if (session?.user?.id) {
    const me = await User.findById(session.user.id).select({ membershipTier: 1 }).lean()
    clientTier = me?.membershipTier || 'FREE'
  }
  const discount = TIER_DISCOUNT[clientTier] || 0
  const finalPrice = +(expert.hourlyRate * (1 - discount / 100)).toFixed(3)

  const stars = Math.round(expert.rating || 0)

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <Link
          href="/consultations"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للخبراء
        </Link>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="relative h-32 bg-gradient-to-bl from-[#1B3A6B] to-[#152c52]" />
          <div className="relative px-6 pb-6">
            <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                {expert.photo ? (
                  <img src={expert.photo} alt={user?.name || ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#C9A84C]/10 text-3xl font-bold text-[#1B3A6B]">
                    {user?.name?.charAt(0) || 'خ'}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
                {user?.name || 'خبير'}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A84C]/15 px-3 py-1 text-xs font-semibold text-[#8a6f2d]">
                  <Award className="h-3 w-3" />
                  {specialtyLabel(expert.specialty)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < stars ? 'fill-[#C9A84C] text-[#C9A84C]' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {expert.rating ? expert.rating.toFixed(1) : 'جديد'}
                </span>
                {expert.experienceYears > 0 && (
                  <span className="text-xs text-gray-600">
                    {expert.experienceYears} سنوات خبرة
                  </span>
                )}
                <span className="text-xs text-gray-600">
                  {expert.totalSessions || 0} جلسة مكتملة
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-bold text-[#1B3A6B]">نبذة عن الخبير</h2>
            {expert.bio ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {expert.bio}
              </p>
            ) : (
              <p className="text-sm text-gray-400">لم يُضف وصف بعد</p>
            )}
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">سعر الساعة</span>
              <Clock className="h-4 w-4 text-[#1B3A6B]" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              {discount > 0 && (
                <span className="text-sm text-gray-400 line-through">
                  {expert.hourlyRate} ر.ع
                </span>
              )}
              <span className="text-3xl font-extrabold text-[#1B3A6B]">
                {finalPrice}
              </span>
              <span className="text-sm text-gray-500">ر.ع</span>
            </div>
            {discount > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <Percent className="h-3 w-3" />
                خصم الأعضاء {discount}%
              </div>
            )}
            <div className="my-5 h-px bg-gray-100" />
            <BookingWidget
              expertId={expert._id}
              hourlyRate={expert.hourlyRate}
              expertName={user?.name}
              clientTier={clientTier}
              authenticated={!!session?.user}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
