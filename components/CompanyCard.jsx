import Link from 'next/link'
import { MapPin, ChevronLeft, Building2 } from 'lucide-react'
import {
  sectorLabel,
  governorateLabel,
  STATUS_LABELS,
  STATUS_BADGE,
} from '@/lib/directory'
import { TIER_META } from '@/lib/membership'

/**
 * Reusable company card.
 * Props: company (plain object), showStatus (for owner/admin views)
 */
export default function CompanyCard({ company, showStatus = false, featured = false }) {
  const sector = sectorLabel(company.sector)
  const gov = governorateLabel(company.governorate)

  return (
    <Link
      href={`/directory/${company.id || company._id}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all hover:-translate-y-1 hover:shadow-lg ${
        featured
          ? 'border-[#C9A84C] shadow-[0_4px_20px_rgba(201,168,76,0.15)] ring-1 ring-[#C9A84C]/30'
          : 'border-gray-200 shadow-sm hover:border-gray-300'
      }`}
    >
      {featured && (
        <div className="absolute top-3 left-3 z-10 rounded-full bg-[#C9A84C] px-3 py-1 text-xs font-bold text-[#1B3A6B]">
          ★ عضو ذهبي
        </div>
      )}

      {/* Top band */}
      <div
        className={`relative flex h-28 items-center justify-center bg-gradient-to-bl ${
          featured ? 'from-[#1B3A6B] to-[#152c52]' : 'from-[#F8F9FA] to-white'
        }`}
      >
        {company.logo ? (
          <img
            src={company.logo}
            alt={company.nameAr}
            className="h-20 w-20 rounded-xl border-4 border-white bg-white object-cover shadow-md"
          />
        ) : (
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-xl border-4 border-white bg-white text-2xl font-bold shadow-md ${
              featured ? 'text-[#C9A84C]' : 'text-[#1B3A6B]'
            }`}
          >
            {company.nameAr?.charAt(0) || <Building2 className="h-8 w-8" />}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Status badge (owner view) */}
        {showStatus && company.status && (
          <div className="mb-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_BADGE[company.status]
              }`}
            >
              {STATUS_LABELS[company.status]}
            </span>
          </div>
        )}

        <h3 className="mb-1 line-clamp-1 text-lg font-bold text-[#1B3A6B] group-hover:text-[#152c52]">
          {company.nameAr}
        </h3>
        {company.nameEn && (
          <div dir="ltr" className="mb-2 line-clamp-1 text-right text-xs text-gray-500">
            {company.nameEn}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-[#1B3A6B]/5 px-2.5 py-0.5 text-xs font-semibold text-[#1B3A6B]">
            {sector}
          </span>
          {gov && (
            <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {gov}
            </span>
          )}
        </div>

        {company.description && (
          <p className="mb-4 line-clamp-2 flex-1 text-sm text-gray-600 leading-relaxed">
            {company.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <span className="text-xs text-gray-400">عرض التفاصيل</span>
          <ChevronLeft className="h-4 w-4 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-[#C9A84C]" />
        </div>
      </div>
    </Link>
  )
}
