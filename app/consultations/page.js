import Link from 'next/link'
import { connectDB } from '@/lib/db'
import { Expert, User } from '@/lib/models'
import ExpertCard from '@/components/ExpertCard'
import ExpertFilters from './_ExpertFilters'
import { SPECIALTY_KEYS, specialtyLabel } from '@/lib/experts'
import { GraduationCap, Users, Plus } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function ConsultationsPage({ searchParams }) {
  const { t } = await getServerT()
  const params = searchParams || {}
  const specialty = SPECIALTY_KEYS.includes(params.specialty)
    ? params.specialty
    : ''

  await connectDB()
  const query = { status: 'APPROVED' }
  if (specialty) query.specialty = specialty
  const experts = await Expert.find(query).sort({ rating: -1, createdAt: -1 }).lean()

  const userIds = experts.map((e) => e.userId)
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, name: 1 })
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]))

  const enriched = experts.map((e) => ({
    ...e,
    id: e._id,
    name: userMap[e.userId]?.name || 'خبير',
  }))

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
              <GraduationCap className="h-4 w-4" />
              {t('consult.badge')}
            </div>
            <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
              {t('consult.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {enriched.length} {t('consult.count.suffix')}
              {specialty && ` ${t('consult.count.in')} ${specialtyLabel(specialty)}`}
            </p>
          </div>
          <Link
            href="/consultations/become-expert"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2.5 text-sm font-semibold text-[#1B3A6B] transition hover:bg-[#1B3A6B] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            {t('consult.becomeExpert')}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <ExpertFilters initial={{ specialty }} />
          </aside>
          <section>
            {enriched.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <Users className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 text-lg font-bold text-gray-700">
                  {t('consult.empty.title')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t('consult.empty.hint')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {enriched.map((e) => (
                  <ExpertCard key={e._id} expert={e} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
