import Link from 'next/link'
import { MapPin, Building2, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  sectorLabel,
  governorateLabel,
} from '@/lib/directory'
import SocialIcons from '@/components/SocialIcons'

/**
 * Horizontal company row — designed for narrow list columns (e.g. the split
 * "map + list" view). Uses a logo-on-side layout so it stays readable even at
 * ~350px column widths.
 */
export default function CompanyRow({ company, featured = false, isRTL = true }) {
  const sector = sectorLabel(company.sector)
  const gov = governorateLabel(company.governorate)
  const social = company.social || {}
  const href = `/directory/${company.id || company._id}`
  const Arrow = isRTL ? ChevronLeft : ChevronRight

  return (
    <div
      className={`group relative flex items-stretch gap-3 overflow-hidden rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
        featured
          ? 'border-[#C9A84C]/60 ring-1 ring-[#C9A84C]/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Full-card link (behind icons/social) */}
      <Link
        href={href}
        aria-label={company.nameAr}
        className="absolute inset-0 z-0"
      />

      {/* Logo */}
      <div className="relative z-0 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-[#F8F9FA] to-white">
        {company.logo ? (
          <img
            src={company.logo}
            alt={company.nameAr}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center text-xl font-extrabold ${
              featured ? 'bg-[#C9A84C]/15 text-[#8a6f2d]' : 'bg-[#1B3A6B]/10 text-[#1B3A6B]'
            }`}
          >
            {company.nameAr?.charAt(0) || <Building2 className="h-6 w-6" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pointer-events-none relative z-0 flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-[#1B3A6B] group-hover:text-[#152c52]">
              {company.nameAr}
            </h3>
            {featured && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#C9A84C] px-1.5 py-0.5 text-[9px] font-bold text-[#1B3A6B]">
                <Star className="h-2.5 w-2.5 fill-[#1B3A6B]" />
                ذهبي
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 text-[11px] leading-tight">
            <span className="inline-flex rounded-full bg-[#1B3A6B]/8 px-1.5 py-0.5 font-semibold text-[#1B3A6B]">
              {sector}
            </span>
            {gov && (
              <span className="inline-flex items-center gap-0.5 text-gray-500">
                <MapPin className="h-3 w-3" />
                {gov}
              </span>
            )}
          </div>
        </div>

        {/* Social icons (clickable) */}
        <div className="pointer-events-auto relative z-10 mt-1.5">
          <SocialIcons links={social} extraWebsite={company.website} size="sm" />
        </div>
      </div>

      {/* Chevron affordance */}
      <div className="pointer-events-none relative z-0 flex items-center text-gray-300 group-hover:text-[#1B3A6B]">
        <Arrow className="h-4 w-4" />
      </div>
    </div>
  )
}
