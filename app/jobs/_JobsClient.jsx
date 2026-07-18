'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Briefcase, MapPin, Clock, Search, Filter, Building2, Users, Plus, User, FileText } from 'lucide-react'
import { SECTORS, GOVERNORATES } from '@/lib/directory'
import { EMPLOYMENT_TYPES, WORK_MODES, EXPERIENCE_LEVELS, labelFrom, formatSalary, daysUntil } from '@/lib/jobs'

export default function JobsClient() {
  const { status } = useSession()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ q: '', sector: '', governorate: '', employmentType: '', workMode: '', experienceLevel: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
      const res = await fetch(`/api/jobs?${params}`)
      const d = await res.json()
      setItems(d.items || [])
      setTotal(d.total || 0)
    } catch (e) { /* silent */ } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      {/* Header + CTAs */}
      <div className="mb-6 rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-6 text-white">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
              <Briefcase className="h-4 w-4" /> منصة فرص العمل
            </div>
            <h1 className="text-2xl font-extrabold md:text-3xl">وظيفتك القادمة تنتظرك</h1>
            <p className="mt-1 text-sm opacity-90">{total} فرصة عمل من شركات عمانية معتمدة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === 'authenticated' ? (
              <>
                <Link href="/jobs/my-profile" className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30">
                  <User className="h-4 w-4" /> ملفي المهني
                </Link>
                <Link href="/jobs/my-applications" className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30">
                  <FileText className="h-4 w-4" /> تقديماتي
                </Link>
                <Link href="/jobs/employer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#b89440]">
                  <Plus className="h-4 w-4" /> انشر وظيفة
                </Link>
              </>
            ) : (
              <Link href="/signup?next=/jobs" className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#b89440]">
                <User className="h-4 w-4" /> ابدأ الآن مجاناً
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="بحث بالمسمى أو المهارة..."
              className="w-full rounded-lg border border-gray-300 py-2 pr-9 text-sm focus:border-[#1B3A6B] focus:outline-none"
            />
          </div>
          <FilterSelect label="القطاع" value={filters.sector} onChange={(v) => setFilters({ ...filters, sector: v })} options={SECTORS.map(s => ({ key: s.key, ar: s.nameAr }))} />
          <FilterSelect label="المحافظة" value={filters.governorate} onChange={(v) => setFilters({ ...filters, governorate: v })} options={GOVERNORATES.map(g => ({ key: g.key, ar: g.nameAr }))} />
          <FilterSelect label="نوع الدوام" value={filters.employmentType} onChange={(v) => setFilters({ ...filters, employmentType: v })} options={EMPLOYMENT_TYPES} />
          <FilterSelect label="مكان العمل" value={filters.workMode} onChange={(v) => setFilters({ ...filters, workMode: v })} options={WORK_MODES} />
          <FilterSelect label="مستوى الخبرة" value={filters.experienceLevel} onChange={(v) => setFilters({ ...filters, experienceLevel: v })} options={EXPERIENCE_LEVELS} />
        </div>
      </div>

      {/* Listing */}
      {loading ? (
        <div className="py-16 text-center text-gray-500">جارٍ التحميل...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-16 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 font-semibold text-gray-700">لا توجد وظائف مطابقة حالياً</p>
          <p className="mt-1 text-xs text-gray-500">جرّب تعديل الفلاتر أو ارجع لاحقاً</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((j) => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none"
    >
      <option value="">{label} (الكل)</option>
      {options.map((o) => <option key={o.key} value={o.key}>{o.ar}</option>)}
    </select>
  )
}

function JobCard({ job }) {
  const daysLeft = daysUntil(job.applyDeadline)
  const salary = formatSalary(job)
  return (
    <Link href={`/jobs/${job.id}`} className="group block rounded-xl border bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#1B3A6B] hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br from-white to-[#F8F9FA]">
          {job.companyLogo ? (
            
            <img src={job.companyLogo} alt={job.companyNameAr} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-[#1B3A6B] group-hover:text-[#152c52]">{job.titleAr}</h3>
          <p className="mt-0.5 truncate text-xs text-gray-500">{job.companyNameAr}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.governorate}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1B3A6B]/8 px-2 py-0.5 text-[#1B3A6B]">
              <Briefcase className="h-3 w-3" /> {labelFrom(EMPLOYMENT_TYPES, job.employmentType)}
            </span>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">{labelFrom(WORK_MODES, job.workMode)}</span>
            <span className="text-gray-400">•</span>
            <span>{labelFrom(EXPERIENCE_LEVELS, job.experienceLevel)}</span>
          </div>
          {salary && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              💰 {salary}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {job.applicantsCount} متقدم</span>
        {daysLeft !== null && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {daysLeft > 0 ? `متبقي ${daysLeft} يوم` : 'ينتهي اليوم'}
          </span>
        )}
      </div>
    </Link>
  )
}
