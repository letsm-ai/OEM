'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Star, Trash2, Eye, Search, Briefcase, RefreshCw, Users } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_MODES, labelFrom, daysUntil } from '@/lib/jobs'

export default function AdminJobsClient() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState({})
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      params.set('page', String(page))
      const res = await fetch(`/api/admin/jobs?${params}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'خطأ'); return }
      setItems(d.items || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
      setStatusCounts(d.statusCounts || {})
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [q, status, page])

  const toggleFeatured = async (id, val) => {
    await fetch(`/api/admin/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: val }) })
    load()
  }
  const del = async (id, title) => {
    if (!confirm(`حذف إعلان "${title}" وجميع تقديماته؟`)) return
    await fetch(`/api/admin/jobs/${id}`, { method: 'DELETE' })
    load()
  }
  const setStatusFor = async (id, newStatus) => {
    await fetch(`/api/admin/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Briefcase className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B]">إدارة فرص العمل</h1>
          <p className="text-sm text-gray-500">{total} إعلان وظيفة</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['نشط', statusCounts.ACTIVE || 0, 'text-emerald-600'],
          ['منتهي', statusCounts.EXPIRED || 0, 'text-amber-600'],
          ['مغلق', statusCounts.CLOSED || 0, 'text-gray-500'],
          ['مسودة', statusCounts.DRAFT || 0, 'text-slate-500'],
        ].map(([label, val, color]) => (
          <div key={label} className="rounded-xl border bg-white p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`mt-1 text-2xl font-extrabold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="بحث بالعنوان أو الشركة..." className="w-full rounded-lg border py-2 pr-9 text-sm" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="CLOSED">مغلق</option>
          <option value="EXPIRED">منتهي</option>
          <option value="DRAFT">مسودة</option>
        </select>
        <button onClick={load} className="rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {loading ? <div className="py-10 text-center">جارٍ التحميل...</div> : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-16 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">لا توجد إعلانات</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">الوظيفة</th>
                <th className="px-3 py-2">الشركة</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">تفاصيل</th>
                <th className="px-3 py-2">تمييز</th>
                <th className="px-3 py-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => {
                const daysLeft = daysUntil(j.applyDeadline)
                return (
                  <tr key={j.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-[#1B3A6B]">{j.titleAr}</div>
                      <div className="text-[10px] text-gray-500">{new Date(j.createdAt).toLocaleDateString('ar')}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {j.companyLogo && <img src={j.companyLogo} alt="" className="h-6 w-6 rounded object-cover" />}
                        <span>{j.companyNameAr}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${j.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : j.status === 'EXPIRED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                        {j.status === 'ACTIVE' ? 'نشط' : j.status === 'EXPIRED' ? 'منتهي' : j.status === 'CLOSED' ? 'مغلق' : 'مسودة'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      <div className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {j.applicantsCount}</div>
                      <div>{labelFrom(EMPLOYMENT_TYPES, j.employmentType)} • {labelFrom(WORK_MODES, j.workMode)}</div>
                      {daysLeft !== null && <div>{daysLeft > 0 ? `متبقي ${daysLeft} يوم` : 'منتهي'}</div>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => toggleFeatured(j.id, !j.featured)} title={j.featured ? 'إلغاء التمييز' : 'تمييز'} className={j.featured ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}>
                        <Star className={`h-5 w-5 ${j.featured ? 'fill-current' : ''}`} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Link href={`/jobs/${j.id}`} target="_blank" className="rounded-md border px-2 py-1 text-xs"><Eye className="h-3 w-3" /></Link>
                        <select value={j.status === 'EXPIRED' ? 'ACTIVE' : j.status} onChange={(e) => setStatusFor(j.id, e.target.value)} className="rounded-md border px-1 py-1 text-xs">
                          <option value="ACTIVE">تفعيل</option>
                          <option value="CLOSED">إغلاق</option>
                          <option value="DRAFT">مسودة</option>
                        </select>
                        <button onClick={() => del(j.id, j.titleAr)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">السابق</button>
          <span className="text-xs">صفحة {page} من {pages}</span>
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">التالي</button>
        </div>
      )}
    </div>
  )
}
