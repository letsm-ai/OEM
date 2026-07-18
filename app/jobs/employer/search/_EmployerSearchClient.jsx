'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search, User, MapPin, Briefcase, Building2, ExternalLink, Loader2, Users, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_MODES, labelFrom } from '@/lib/jobs'
import { SECTORS, GOVERNORATES } from '@/lib/directory'

export default function EmployerSearchClient() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filters, setFilters] = useState({
    q: '', sector: '', governorate: '', workMode: '', employmentType: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      params.set('page', String(page))
      const res = await fetch(`/api/employer/seekers?${params}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'خطأ'); setErrorCode(d.code || ''); return }
      setItems(d.items || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    } finally { setLoading(false) }
  }, [filters, page])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signup?next=/jobs/employer/search'); return }
    if (status !== 'authenticated') return
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [status, load])

  const clearFilters = () => {
    setFilters({ q: '', sector: '', governorate: '', workMode: '', employmentType: '' })
    setPage(1)
  }
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  if (loading && items.length === 0) return <div className="py-16 text-center text-gray-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>

  if (error && errorCode === 'NO_COMPANY') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <Building2 className="mx-auto h-14 w-14 text-gray-400" />
        <h1 className="mt-4 text-xl font-bold text-[#1B3A6B]">سجّل شركتك أولاً</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <Link href="/directory/add-company" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2.5 text-sm font-semibold text-white">
          أضف شركتي للدليل
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link href="/jobs/employer" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]">
          <ArrowRight className="h-4 w-4" /> لوحة إدارة الوظائف
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-6 text-white">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
              <Users className="h-4 w-4" /> قاعدة المرشحين
            </div>
            <h1 className="text-2xl font-extrabold md:text-3xl">ابحث عن الموهبة المناسبة</h1>
            <p className="mt-1 text-sm opacity-90">{total} مرشح متاح للعمل</p>
          </div>
          <div className="rounded-lg bg-white/10 px-3 py-2 text-[11px]">
            🔒 ملفات عامة — رقم الهاتف والإيميل يظهران فقط عندما يتقدّم المرشح لإحدى وظائفك
          </div>
        </div>
      </div>

      {/* Search bar + filter toggle */}
      <div className="mb-4 rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1) }}
              placeholder="ابحث بالاسم، المسمّى، أو المهارة (React, Marketing...)"
              className="w-full rounded-lg border border-gray-300 py-2 pr-9 text-sm focus:border-[#1B3A6B] focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${activeFilterCount > 0 ? 'bg-[#1B3A6B] text-white' : 'border border-gray-300 text-gray-700'}`}
          >
            <Filter className="h-4 w-4" /> فلاتر {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs text-gray-500">
              <X className="h-3 w-3" /> مسح
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="القطاع المفضّل" value={filters.sector} onChange={(v) => { setFilters({ ...filters, sector: v }); setPage(1) }} options={SECTORS.map((s) => ({ key: s.key, ar: s.nameAr }))} />
            <FilterSelect label="المحافظة" value={filters.governorate} onChange={(v) => { setFilters({ ...filters, governorate: v }); setPage(1) }} options={GOVERNORATES.map((g) => ({ key: g.key, ar: g.nameAr }))} />
            <FilterSelect label="أسلوب العمل" value={filters.workMode} onChange={(v) => { setFilters({ ...filters, workMode: v }); setPage(1) }} options={WORK_MODES} />
            <FilterSelect label="نوع الدوام" value={filters.employmentType} onChange={(v) => { setFilters({ ...filters, employmentType: v }); setPage(1) }} options={EMPLOYMENT_TYPES} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 font-semibold text-gray-700">لا يوجد مرشحون مطابقون حالياً</p>
          <p className="mt-1 text-xs text-gray-500">جرّب توسيع الفلاتر أو الإعلان عن وظيفة لجذب المواهب</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => <SeekerCard key={s.id} seeker={s} />)}
          </div>

          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-600">صفحة {page} من {pages}</span>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none">
      <option value="">{label} (الكل)</option>
      {options.map((o) => <option key={o.key} value={o.key}>{o.ar}</option>)}
    </select>
  )
}

function SeekerCard({ seeker }) {
  const [showAll, setShowAll] = useState(false)
  const visibleSkills = showAll ? seeker.skills : (seeker.skills || []).slice(0, 5)
  const hasMoreSkills = (seeker.skills?.length || 0) > 5

  return (
    <div className="rounded-xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#C9A84C]/30 bg-gray-100">
          {seeker.photo ? (
            <img src={seeker.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#1B3A6B]/10 text-lg font-bold text-[#1B3A6B]">
              {(seeker.fullName || '?').charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-[#1B3A6B]">{seeker.fullName}</h3>
          <p className="truncate text-xs font-medium text-gray-700">{seeker.title || '—'}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            <Briefcase className="inline h-3 w-3" /> {seeker.yearsOfExperience || 0} سنة خبرة
          </p>
        </div>
      </div>

      {seeker.bio && (
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-600">{seeker.bio}</p>
      )}

      {visibleSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {visibleSkills.map((s) => (
            <span key={s} className="rounded-full bg-[#1B3A6B]/8 px-2 py-0.5 text-[10px] text-[#1B3A6B]">{s}</span>
          ))}
          {hasMoreSkills && !showAll && (
            <button onClick={() => setShowAll(true)} className="rounded-full border px-2 py-0.5 text-[10px] text-gray-500">
              +{seeker.skills.length - 5}
            </button>
          )}
        </div>
      )}

      {(seeker.desiredSectors?.length > 0 || seeker.desiredGovernorates?.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1 text-[10px] text-gray-500">
          {(seeker.desiredGovernorates || []).slice(0, 2).map((g) => (
            <span key={g} className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {g}</span>
          ))}
        </div>
      )}

      {seeker.links?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
          {seeker.links.slice(0, 4).map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-blue-600 hover:border-blue-400">
              <ExternalLink className="h-2.5 w-2.5" /> {l.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-[10px] text-gray-400">
        <span>حلّث: {new Date(seeker.updatedAt).toLocaleDateString('ar')}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          متاح للعمل
        </span>
      </div>
    </div>
  )
}
