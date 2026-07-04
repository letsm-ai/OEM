'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CompanyCard from '@/components/CompanyCard'
import { Building2, List, Map as MapIcon, LayoutGrid, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'

// Leaflet uses window — must be client-side only.
const DirectoryMap = dynamic(() => import('@/components/DirectoryMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
    </div>
  ),
})

export default function DirectoryClient({ companies, featuredIds, filtered }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [view, setView] = useState(() => sp.get('view') || 'list')
  const sort = sp.get('sort') || 'newest'
  const { t } = useI18n()

  const SORT_OPTIONS = [
    { value: 'newest', label: t('dir.sort.newest') },
    { value: 'oldest', label: t('dir.sort.oldest') },
    { value: 'name', label: t('dir.sort.nameAsc') },
    { value: 'name_desc', label: t('dir.sort.nameDesc') },
  ]

  const setParam = (key, value) => {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`/directory?${p.toString()}`)
  }

  const changeView = (v) => {
    setView(v)
    setParam('view', v === 'list' ? '' : v)
  }

  const withLocation = companies.filter(
    (c) => c.governorate || (typeof c.lat === 'number' && typeof c.lng === 'number')
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <ViewBtn
            active={view === 'list'}
            onClick={() => changeView('list')}
            icon={<List className="h-3.5 w-3.5" />}
            label={t('dir.view.list')}
          />
          <ViewBtn
            active={view === 'map'}
            onClick={() => changeView('map')}
            icon={<MapIcon className="h-3.5 w-3.5" />}
            label={t('dir.view.map')}
          />
          <ViewBtn
            active={view === 'split'}
            onClick={() => changeView('split')}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label={t('dir.view.split')}
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">{t('dir.sort.label')}</label>
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{companies.length} {t('dir.count.companies')}</span>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-3 text-lg font-bold text-gray-700">
            {t('dir.empty.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('dir.empty.hint')}
          </p>
          <Link
            href="/directory"
            className="mt-4 inline-flex rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white"
          >
            {t('dir.clearFilter')}
          </Link>
        </div>
      ) : view === 'map' ? (
        <DirectoryMap
          companies={withLocation}
          featuredIds={featuredIds}
          height={600}
        />
      ) : view === 'split' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <DirectoryMap
            companies={withLocation}
            featuredIds={featuredIds}
            height={600}
          />
          <div className="grid max-h-[600px] gap-2.5 overflow-y-auto pr-1">
            {companies.map((c) => (
              <CompanyCard
                key={c.id}
                company={c}
                featured={featuredIds.includes(c.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              featured={featuredIds.includes(c.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ViewBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-[#1B3A6B] text-white shadow'
          : 'text-gray-700 hover:text-[#1B3A6B]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
