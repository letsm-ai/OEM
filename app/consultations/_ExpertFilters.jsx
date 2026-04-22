'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SPECIALTIES } from '@/lib/experts'
import { SlidersHorizontal } from 'lucide-react'

export default function ExpertFilters({ initial }) {
  const router = useRouter()
  const sp = useSearchParams()
  const active = sp.get('specialty') || ''

  const apply = (value) => {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set('specialty', value)
    else p.delete('specialty')
    router.push(`/consultations?${p.toString()}`)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">
        <SlidersHorizontal className="h-4 w-4" />
        التخصص
      </div>
      <div className="space-y-1">
        <button
          onClick={() => apply('')}
          className={`block w-full rounded-lg px-3 py-1.5 text-right text-sm transition ${
            !active ? 'bg-[#1B3A6B] text-white' : 'text-gray-700 hover:bg-[#F8F9FA]'
          }`}
        >
          الكل
        </button>
        {SPECIALTIES.map((s) => (
          <button
            key={s.key}
            onClick={() => apply(s.key)}
            className={`block w-full rounded-lg px-3 py-1.5 text-right text-sm transition ${
              active === s.key
                ? 'bg-[#1B3A6B] text-white'
                : 'text-gray-700 hover:bg-[#F8F9FA]'
            }`}
          >
            <span className="ml-1">{s.emoji}</span>
            {s.nameAr}
          </button>
        ))}
      </div>
    </div>
  )
}
