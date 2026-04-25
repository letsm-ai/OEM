import Link from 'next/link'
import { MapPin, Building2, Star } from 'lucide-react'
import {
  sectorLabel,
  governorateLabel,
  STATUS_LABELS,
  STATUS_BADGE,
} from '@/lib/directory'
import SocialIcons from '@/components/SocialIcons'

/**
 * Compact vertical company card — fits up to 8 per row on xl screens.
 * Used in the public directory grid + owner/admin views.
 */
export default function CompanyCard({
  company,
  showStatus = false,
  featured = false,
}) {
  const sector = sectorLabel(company.sector)
  const gov = governorateLabel(company.governorate)
  const social = company.social || {}

  const href = `/directory/${company.id || company._id}`
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white transition hover:-translate-y-0.5 hover:shadow-md ${
        featured
          ? 'border-[#C9A84C]/60 ring-1 ring-[#C9A84C]/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Stretched link covers the whole card (except social icons which stay above) */}
      <Link
        href={href}
        aria-label={company.nameAr}
        className="absolute inset-0 z-0"
      />

      {/* Gold corner ribbon for featured */}
      {featured && (
        <span
          className="pointer-events-none absolute top-0 left-0 z-10 inline-flex items-center gap-0.5 rounded-br-md bg-[#C9A84C] px-1.5 py-0.5 text-[9px] font-bold text-[#1B3A6B]"
          aria-hidden
        >
          <Star className="h-2.5 w-2.5 fill-[#1B3A6B]" />
          ذهبي
        </span>
      )}

      {/* Status badge (admin/owner views) */}
      {showStatus && company.status && (
        <span
          className={`pointer-events-none absolute top-1 right-1 z-10 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[company.status]}`}
        >
          {STATUS_LABELS[company.status]}
        </span>
      )}

      {/* Logo area */}
      <div className={`pointer-events-none relative z-0 flex h-24 items-center justify-center ${featured ? 'bg-[#1B3A6B]/5' : 'bg-gradient-to-br from-[#F8F9FA] to-white'}`}>
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo}
            alt={company.nameAr}
            className="h-16 w-16 rounded-lg border border-gray-200 bg-white object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-lg text-2xl font-extrabold ${
              featured
                ? 'bg-[#C9A84C]/15 text-[#8a6f2d]'
                : 'bg-[#1B3A6B]/10 text-[#1B3A6B]'
            }`}
          >
            {company.nameAr?.charAt(0) || <Building2 className="h-7 w-7" />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pointer-events-none relative z-0 flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 min-h-[2.4em] text-[12px] font-bold leading-tight text-[#1B3A6B] group-hover:text-[#152c52]">
          {company.nameAr}
        </h3>

        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="inline-flex rounded-full bg-[#1B3A6B]/8 px-1.5 py-0.5 font-semibold text-[#1B3A6B]">
            {sector}
          </span>
          {gov && (
            <span className="inline-flex items-center gap-0.5 text-gray-500">
              <MapPin className="h-2.5 w-2.5" />
              {gov}
            </span>
          )}
        </div>

        {/* Social icons (if any) — pointer-events re-enabled so the small <a> tags stay clickable */}
        <div className="pointer-events-auto relative z-10 mt-auto pt-1.5">
          <SocialIcons links={social} extraWebsite={company.website} size="sm" />
        </div>
      </div>
    </div>
  )
}
