import Link from 'next/link'
import { Star, Clock } from 'lucide-react'
import { specialtyLabel } from '@/lib/experts'
import SocialIcons from '@/components/SocialIcons'

/**
 * Compact vertical expert card — fits up to 8 per row on xl screens.
 */
export default function ExpertCard({ expert }) {
  const stars = Math.round(expert.rating || 0)
  return (
    <Link
      href={`/consultations/${expert.id || expert._id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A84C] hover:shadow-md"
    >
      <div className="relative flex h-16 items-center justify-center bg-gradient-to-bl from-[#1B3A6B] to-[#152c52]">
        <div className="absolute -bottom-7 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm">
          {expert.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={expert.photo} alt={expert.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#C9A84C]/10 text-lg font-bold text-[#1B3A6B]">
              {expert.name?.charAt(0) || 'خ'}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1 px-2 pb-2.5 pt-9 text-center">
        <h3 className="line-clamp-1 text-[12px] font-bold leading-tight text-[#1B3A6B]">
          {expert.name || 'خبير'}
        </h3>
        <div className="line-clamp-1 text-[10px] text-[#8a6f2d]">
          {specialtyLabel(expert.specialty)}
        </div>

        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-2.5 w-2.5 ${
                i < stars ? 'fill-[#C9A84C] text-[#C9A84C]' : 'text-gray-300'
              }`}
            />
          ))}
          {expert.rating ? (
            <span className="mr-0.5 text-[9px] text-gray-500">
              {expert.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#1B3A6B]/5 px-2 py-0.5 text-[10px] font-semibold text-[#1B3A6B]">
          <Clock className="h-2.5 w-2.5" />
          {expert.hourlyRate} ر.ع / ساعة
        </div>

        <div className="mt-1 w-full">
          <SocialIcons links={expert.social || {}} extraWebsite={expert.website} size="sm" className="justify-center" />
        </div>
      </div>
    </Link>
  )
}
