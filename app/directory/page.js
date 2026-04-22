import Link from 'next/link'
import { connectDB } from '@/lib/db'
import { Company, User } from '@/lib/models'
import CompanyCard from '@/components/CompanyCard'
import DirectoryFilters from './_DirectoryFilters'
import { Search, Building2, Plus } from 'lucide-react'
import {
  SECTOR_KEYS,
  GOVERNORATE_KEYS,
  sectorLabel,
  governorateLabel,
} from '@/lib/directory'

export const dynamic = 'force-dynamic'

export default async function DirectoryPage({ searchParams }) {
  const params = searchParams || {}
  const search = (params.search || '').toString().trim()
  const sector = SECTOR_KEYS.includes(params.sector) ? params.sector : ''
  const gov = GOVERNORATE_KEYS.includes(params.gov) ? params.gov : ''

  await connectDB()

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
    ]
  }

  const companies = await Company.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
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

  // Sort: featured first
  const ordered = [...companies].sort((a, b) => {
    const af = isFeatured(tierByUser[a.userId]) ? 1 : 0
    const bf = isFeatured(tierByUser[b.userId]) ? 1 : 0
    return bf - af
  })

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
              <Building2 className="h-4 w-4" />
              دليل الشركات العمانية
            </div>
            <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
              شركات رواد الأعمال العمانيين
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {ordered.length} شركة معتمدة
              {(sector || gov || search) && ' بعد التصفية'}
            </p>
          </div>
          <Link
            href="/directory/add-company"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#152c52]"
          >
            <Plus className="h-4 w-4" />
            أضف شركتك
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
            {(sector || gov || search) && (
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
                  مسح التصفية
                </Link>
              </div>
            )}

            {ordered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <Building2 className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 text-lg font-bold text-gray-700">
                  لا توجد شركات مطابقة
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  جرِّب تعديل البحث أو مسح التصفية
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {ordered.map((c) => (
                  <CompanyCard
                    key={c._id}
                    company={{ ...c, id: c._id }}
                    featured={isFeatured(tierByUser[c.userId])}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
