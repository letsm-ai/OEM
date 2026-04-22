import Link from 'next/link'
import { Star, Clock, ChevronLeft } from 'lucide-react'
import { specialtyLabel } from '@/lib/experts'

export default function ExpertCard({ expert }) {
  const stars = Math.round(expert.rating || 0)
  return (
    <Link
      href={`/consultations/${expert.id || expert._id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#C9A84C] hover:shadow-lg"
    >
      <div className="relative flex h-24 items-center justify-center bg-gradient-to-bl from-[#1B3A6B] to-[#152c52]">
        <div className="absolute -bottom-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white">
          {expert.photo ? (
            <img
              src={expert.photo}
              alt={expert.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#C9A84C]/10 text-2xl font-bold text-[#1B3A6B]">
              {expert.name?.charAt(0) || 'خ'}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-4 pb-5 pt-12 text-center">
        <h3 className="text-base font-bold text-[#1B3A6B]">
          {expert.name || 'خبير'}
        </h3>
        <div className="mt-1 text-xs text-[#8a6f2d]">
          {specialtyLabel(expert.specialty)}
        </div>

        {/* Stars */}
        <div className="mt-2 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < stars ? 'fill-[#C9A84C] text-[#C9A84C]' : 'text-gray-300'
              }`}
            />
          ))}
          {expert.rating ? (
            <span className="mr-1 text-xs text-gray-500">
              {expert.rating.toFixed(1)}
            </span>
          ) : (
            <span className="mr-1 text-xs text-gray-400">جديد</span>
          )}
        </div>

        {expert.bio && (
          <p className="mt-3 line-clamp-2 text-xs text-gray-600 leading-relaxed">
            {expert.bio}
          </p>
        )}

        <div className="mt-4 flex items-center gap-1.5 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-semibold text-[#1B3A6B]">
          <Clock className="h-3 w-3" />
          {expert.hourlyRate} ر.ع / ساعة
        </div>

        <div className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg bg-[#1B3A6B] py-2 text-sm font-semibold text-white transition group-hover:bg-[#152c52]">
          احجز الآن
          <ChevronLeft className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}
