import Link from 'next/link'
import { MapPin, ChevronLeft, Building2, Star } from 'lucide-react'
import {
  sectorLabel,
  governorateLabel,
  STATUS_LABELS,
  STATUS_BADGE,
} from '@/lib/directory'

/**
 * Compact company card: horizontal layout, logo on one side and content on
 * the other. Designed to pack more cards per viewport while remaining
 * scannable. Used both in the public directory grid and in the owner/admin
 * views (toggle via `showStatus`).
 */
export default function CompanyCard({
  company,
  showStatus = false,
  featured = false,
}) {
  const sector = sectorLabel(company.sector)
  const gov = governorateLabel(company.governorate)

  return (
    <Link
      href={`/directory/${company.id || company._id}`}
      className={`group relative flex overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md ${
        featured
          ? 'border-[#C9A84C]/60 ring-1 ring-[#C9A84C]/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Gold strip for featured */}
      {featured && (
        <span
          className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-[#C9A84C] to-[#a78a38]"
          aria-hidden
        />
      )}

      {/* Logo / initial */}
      <div
        className={`flex h-full w-20 flex-shrink-0 items-center justify-center ${
          featured ? 'bg-[#1B3A6B]/5' : 'bg-[#F8F9FA]'
        }`}
      >
        {company.logo ? (
          <img
            src={company.logo}
            alt={company.nameAr}
            className="h-14 w-14 rounded-lg border border-gray-200 object-cover"
          />
        ) : (
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-lg text-xl font-extrabold ${
              featured
                ? 'bg-[#C9A84C]/15 text-[#8a6f2d]'
                : 'bg-[#1B3A6B]/10 text-[#1B3A6B]'
            }`}
          >
            {company.nameAr?.charAt(0) || <Building2 className="h-6 w-6" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-[#1B3A6B] group-hover:text-[#152c52]">
              {company.nameAr}
            </h3>
            {featured && (
              <span
                title="عضو ذهبي"
                className="inline-flex h-4 items-center rounded-full bg-[#C9A84C] px-1.5 text-[9px] font-bold text-[#1B3A6B]"
              >
                <Star className="ml-0.5 h-2.5 w-2.5 fill-[#1B3A6B]" />
                ذهبي
              </span>
            )}
            {showStatus && company.status && (
              <span
                className={`ms-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  STATUS_BADGE[company.status]
                }`}
              >
                {STATUS_LABELS[company.status]}
              </span>
            )}
          </div>
          {company.nameEn && (
            <div
              dir="ltr"
              className="truncate text-right text-[11px] text-gray-400"
            >
              {company.nameEn}
            </div>
          )}

          {company.description && (
            <p className="mt-1 line-clamp-1 text-[12px] leading-snug text-gray-600">
              {company.description}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex shrink-0 rounded-full bg-[#1B3A6B]/8 px-2 py-0.5 font-semibold text-[#1B3A6B]">
              {sector}
            </span>
            {gov && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-gray-500">
                <MapPin className="h-3 w-3" />
                {gov}
              </span>
            )}
          </div>
          <ChevronLeft className="h-4 w-4 flex-shrink-0 text-gray-300 transition group-hover:-translate-x-0.5 group-hover:text-[#C9A84C]" />
        </div>
      </div>
    </Link>
  )
}
