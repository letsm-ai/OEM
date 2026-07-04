import Link from 'next/link'
import { connectDB } from '@/lib/db'
import { Company, User } from '@/lib/models'
import DirectoryFilters from './_DirectoryFilters'
import DirectoryClient from './_DirectoryClient'
import { Search, Building2, Plus, Lock, Sparkles } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  SECTOR_KEYS,
  GOVERNORATE_KEYS,
  sectorLabel,
  governorateLabel,
} from '@/lib/directory'
import { getServerT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { nameAr: 1 },
  name_desc: { nameAr: -1 },
}

const PAID_TIERS = ['BASIC', 'GOLD', 'PLATINUM']
const FREE_PER_SECTOR_LIMIT = 5

export default async function DirectoryPage({ searchParams }) {
  const { t } = await getServerT()
  const params = searchParams || {}
  const search = (params.search || '').toString().trim()
  const sector = SECTOR_KEYS.includes(params.sector) ? params.sector : ''
  const gov = GOVERNORATE_KEYS.includes(params.gov) ? params.gov : ''
  const sortKey = SORT_MAP[params.sort] ? params.sort : 'newest'

  await connectDB()

  // Determine viewer's access tier
  const session = await getServerSession(authOptions)
  let viewerTier = 'GUEST'
  if (session?.user?.id) {
    const me = await User.findById(session.user.id).select('membershipTier role').lean()
    viewerTier = me?.role === 'ADMIN' ? 'ADMIN' : (me?.membershipTier || 'FREE')
  }
  const hasFullAccess = viewerTier === 'ADMIN' || PAID_TIERS.includes(viewerTier)

  const query = { status: 'APPROVED' }
  if (sector) query.sector = sector
  if (gov) query.governorate = gov
  if (search) {
    const rx = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    query.$or = [
      { nameAr: rx },
      { nameEn: rx },
      { description: rx },
      { services: rx },
      { location: rx },
    ]
  }

  const companies = await Company.find(query)
    .sort(SORT_MAP[sortKey])
    .limit(500)
    .lean()

  // Fetch owners' tiers to mark "featured" (GOLD+) cards
  const userIds = Array.from(new Set(companies.map((c) => c.userId)))
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, membershipTier: 1 })
    .lean()
  const tierByUser = Object.fromEntries(
    users.map((u) => [u._id, u.membershipTier])
  )
  const isFeatured = (tier) => tier === 'GOLD' || tier === 'PLATINUM'

  // Sort featured first only if user chose default (newest)
  const ordered = sortKey === 'newest'
    ? [...companies].sort((a, b) => {
        const af = isFeatured(tierByUser[a.userId]) ? 1 : 0
        const bf = isFeatured(tierByUser[b.userId]) ? 1 : 0
        return bf - af
      })
    : companies

  const mapped = ordered.map((c) => ({ ...c, id: c._id }))
  const featuredIds = mapped
    .filter((c) => isFeatured(tierByUser[c.userId]))
    .map((c) => c.id)

  // Apply per-sector cap for guests + FREE-tier viewers (5 per sector).
  // Priority within each sector: featured (GOLD/PLATINUM) first, then by current sort order.
  let visible = mapped
  let totalCount = mapped.length
  let hiddenCount = 0
  if (!hasFullAccess) {
    const bucketsBySector = new Map()
    for (const c of mapped) {
      const key = c.sector || 'OTHER'
      if (!bucketsBySector.has(key)) bucketsBySector.set(key, [])
      bucketsBySector.get(key).push(c)
    }
    const limited = []
    for (const [, list] of bucketsBySector) {
      // Sort: featured first, then keep existing relative order
      const sorted = [...list].sort((a, b) => {
        const af = isFeatured(tierByUser[a.userId]) ? 1 : 0
        const bf = isFeatured(tierByUser[b.userId]) ? 1 : 0
        return bf - af
      })
      limited.push(...sorted.slice(0, FREE_PER_SECTOR_LIMIT))
    }
    hiddenCount = mapped.length - limited.length
    visible = limited
  }

  const hasFilter = !!(sector || gov || search)

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
              <Building2 className="h-4 w-4" />
              {t('dir.badge')}
            </div>
            <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
              {t('dir.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {visible.length} {t('dir.count.suffix')}
              {hasFilter && ` ${t('dir.count.filtered')}`}
              {hiddenCount > 0 && (
                <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  <Lock className="h-3 w-3" />
                  +{hiddenCount} {t('dir.count.hidden')}
                </span>
              )}
            </p>
          </div>
          <Link
            href="/directory/add-company"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#152c52]"
          >
            <Plus className="h-4 w-4" />
            {t('dir.addCompany')}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filters */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <DirectoryFilters initial={{ search, sector, gov }} />
          </aside>

          {/* Results */}
          <section>
            {/* Active filter chips */}
            {hasFilter && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {search && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200">
                    <Search className="h-3 w-3" />
                    {search}
                  </span>
                )}
                {sector && (
                  <span className="inline-flex rounded-full bg-[#1B3A6B]/10 px-3 py-1 text-xs font-semibold text-[#1B3A6B]">
                    {sectorLabel(sector)}
                  </span>
                )}
                {gov && (
                  <span className="inline-flex rounded-full bg-[#C9A84C]/15 px-3 py-1 text-xs font-semibold text-[#8a6f2d]">
                    {governorateLabel(gov)}
                  </span>
                )}
                <Link
                  href="/directory"
                  className="text-xs font-medium text-gray-500 underline-offset-2 hover:underline"
                >
                  {t('dir.clearFilter')}
                </Link>
              </div>
            )}

            <DirectoryClient
              companies={visible}
              featuredIds={featuredIds}
              filtered={hasFilter}
            />

            {/* Upgrade CTA banner for guests / FREE viewers when companies are hidden */}
            {!hasFullAccess && hiddenCount > 0 && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-[#C9A84C]/40 bg-gradient-to-bl from-[#C9A84C]/15 to-[#C9A84C]/5 p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C9A84C] text-[#1B3A6B]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <h3 className="text-base font-extrabold text-[#1B3A6B]">
                      {t('dir.upgrade.title').replace('{n}', hiddenCount)}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-700">
                      {t('dir.upgrade.body')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewerTier === 'GUEST' ? (
                      <>
                        <Link
                          href="/signup"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-bold text-white hover:bg-[#152c52]"
                        >
                          {t('dir.upgrade.signup')}
                        </Link>
                        <Link
                          href="/membership"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
                        >
                          {t('dir.upgrade.browse')}
                        </Link>
                      </>
                    ) : (
                      <Link
                        href="/membership"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
                      >
                        {t('dir.upgrade.now')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
