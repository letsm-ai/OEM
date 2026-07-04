'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, Filter } from 'lucide-react'
import { SECTORS, GOVERNORATES } from '@/lib/directory'
import { useI18n } from '@/lib/i18n/I18nContext'

export default function DirectoryFilters({ initial }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [search, setSearch] = useState(initial?.search || '')
  const { t, isRTL } = useI18n()
  const textAlign = isRTL ? 'text-right' : 'text-left'

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const current = sp.get('search') || ''
      if (search === current) return
      const p = new URLSearchParams(sp.toString())
      if (search) p.set('search', search)
      else p.delete('search')
      router.push(`/directory?${p.toString()}`)
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const applyFilter = (key, value) => {
    const p = new URLSearchParams(sp.toString())
    const current = p.get(key)
    if (value && value !== current) p.set(key, value)
    else p.delete(key)
    router.push(`/directory?${p.toString()}`)
  }

  const activeSector = sp.get('sector') || ''
  const activeGov = sp.get('gov') || ''

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">
          <Search className="h-4 w-4" />
          {t('dir.search.label')}
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('dir.search.placeholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
        />
      </div>

      {/* Sector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">
          <SlidersHorizontal className="h-4 w-4" />
          {t('dir.filter.sector')}
        </div>
        <div className="space-y-1">
          <button
            onClick={() => applyFilter('sector', '')}
            className={`block w-full rounded-lg px-3 py-1.5 ${textAlign} text-sm transition ${
              !activeSector
                ? 'bg-[#1B3A6B] text-white'
                : 'text-gray-700 hover:bg-[#F8F9FA]'
            }`}
          >
            {t('dir.filter.all')}
          </button>
          {SECTORS.map((s) => (
            <button
              key={s.key}
              onClick={() => applyFilter('sector', s.key)}
              className={`block w-full rounded-lg px-3 py-1.5 ${textAlign} text-sm transition ${
                activeSector === s.key
                  ? 'bg-[#1B3A6B] text-white'
                  : 'text-gray-700 hover:bg-[#F8F9FA]'
              }`}
            >
              <span className={isRTL ? 'ml-1' : 'mr-1'}>{s.emoji}</span>
              {s.nameAr}
            </button>
          ))}
        </div>
      </div>

      {/* Governorate */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1B3A6B]">
          <Filter className="h-4 w-4" />
          {t('dir.filter.gov')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => applyFilter('gov', '')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              !activeGov
                ? 'bg-[#C9A84C] text-[#1B3A6B]'
                : 'bg-[#F8F9FA] text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t('dir.filter.all')}
          </button>
          {GOVERNORATES.map((g) => (
            <button
              key={g.key}
              onClick={() => applyFilter('gov', g.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeGov === g.key
                  ? 'bg-[#C9A84C] text-[#1B3A6B]'
                  : 'bg-[#F8F9FA] text-gray-700 hover:bg-gray-100'
              }`}
            >
              {g.nameAr}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
