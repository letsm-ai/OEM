'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertCircle, Search, ShieldCheck, ShieldOff, Crown, ChevronLeft, ChevronRight } from 'lucide-react'
import { SkeletonStats, SkeletonList } from '@/components/Skeleton'
import EmptyState from '@/components/EmptyState'

const ROLE_LABEL = { ADMIN: 'مسؤول', MEMBER: 'عضو', VENDOR: 'بائع', EXPERT: 'خبير' }
const TIER_LABEL = { FREE: 'مجاني', BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }
const TIER_COLOR = {
  FREE: 'bg-gray-100 text-gray-700',
  BASIC: 'bg-blue-100 text-blue-700',
  GOLD: 'bg-amber-100 text-amber-800',
  PLATINUM: 'bg-purple-100 text-purple-700',
}
const ROLE_COLOR = {
  ADMIN: 'bg-red-100 text-red-700',
  MEMBER: 'bg-gray-100 text-gray-700',
  VENDOR: 'bg-emerald-100 text-emerald-700',
  EXPERT: 'bg-indigo-100 text-indigo-700',
}

export default function UsersClient({ currentUserId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filters, setFilters] = useState({ role: '', tier: '', suspended: '', search: '' })
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams()
      if (filters.role) params.set('role', filters.role)
      if (filters.tier) params.set('tier', filters.tier)
      if (filters.suspended) params.set('suspended', filters.suspended)
      if (filters.search) params.set('search', filters.search)
      params.set('page', String(page))
      params.set('limit', '20')
      const r = await fetch(`/api/admin/users?${params.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'خطأ')
      setData(j)
    } catch (e) {
      setErr(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  const updateUser = async (id, body) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) {
        alert(j.error || 'فشلت العملية')
      } else {
        await load()
      }
    } finally {
      setBusyId('')
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonStats count={4} />
        <SkeletonList rows={6} />
      </div>
    )
  }
  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <AlertCircle className="h-5 w-5" /> {err}
      </div>
    )
  }
  if (!data) return null

  const t = data.totals
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'الإجمالي', value: t.total, color: 'text-[#1B3A6B]' },
          { label: 'مسؤولون', value: t.admins, color: 'text-red-600' },
          { label: 'بائعون', value: t.vendors, color: 'text-emerald-600' },
          { label: 'خبراء', value: t.experts, color: 'text-indigo-600' },
          { label: 'معلقون', value: t.suspended, color: 'text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] text-gray-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
              placeholder="ابحث بالاسم أو البريد..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select value={filters.role} onChange={(e) => { setFilters({ ...filters, role: e.target.value }); setPage(1) }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium">
            <option value="">كل الأدوار</option>
            <option value="ADMIN">مسؤول</option>
            <option value="MEMBER">عضو</option>
            <option value="VENDOR">بائع</option>
            <option value="EXPERT">خبير</option>
          </select>
          <select value={filters.tier} onChange={(e) => { setFilters({ ...filters, tier: e.target.value }); setPage(1) }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium">
            <option value="">كل الباقات</option>
            <option value="FREE">مجاني</option>
            <option value="BASIC">أساسي</option>
            <option value="GOLD">ذهبي</option>
            <option value="PLATINUM">بلاتيني</option>
          </select>
          <select value={filters.suspended} onChange={(e) => { setFilters({ ...filters, suspended: e.target.value }); setPage(1) }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium">
            <option value="">الكل</option>
            <option value="0">نشط</option>
            <option value="1">معلق</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {data.users.length === 0 ? (
        <EmptyState title="لا يوجد مستخدمون مطابقون" description="حاول تغيير الفلاتر" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <tr>
                  <th className="p-3 text-right">المستخدم</th>
                  <th className="p-3 text-right">الدور</th>
                  <th className="p-3 text-right">الباقة</th>
                  <th className="p-3 text-right">تاريخ الانضمام</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.users.map((u) => {
                  const isMe = u.id === currentUserId
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-semibold text-[#1B3A6B]">{u.name}{isMe && <span className="ms-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">أنت</span>}</div>
                        <div className="text-[11px] text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          disabled={isMe || busyId === u.id}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className={`rounded-md px-2 py-1 text-[11px] font-bold ${ROLE_COLOR[u.role]} disabled:opacity-50`}
                        >
                          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${TIER_COLOR[u.membershipTier]}`}>
                          {u.membershipTier === 'GOLD' || u.membershipTier === 'PLATINUM' ? <Crown className="h-3 w-3" /> : null}
                          {TIER_LABEL[u.membershipTier]}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-gray-500">
                        {new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(u.createdAt))}
                      </td>
                      <td className="p-3">
                        {u.isSuspended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            <ShieldOff className="h-3 w-3" /> معلّق
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            <ShieldCheck className="h-3 w-3" /> نشط
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {!isMe && (
                          u.isSuspended ? (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => updateUser(u.id, { action: 'activate' })}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {busyId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'تفعيل'}
                            </button>
                          ) : (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => {
                                const reason = prompt('سبب التعليق (اختياري):') || ''
                                updateUser(u.id, { action: 'suspend', reason })
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {busyId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'تعليق'}
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <div>صفحة {data.pagination.page} من {data.pagination.pages} • {data.pagination.total} مستخدم</div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 bg-white px-2 py-1 disabled:opacity-50"><ChevronRight className="h-3 w-3" /></button>
              <button disabled={page >= data.pagination.pages || loading} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 bg-white px-2 py-1 disabled:opacity-50"><ChevronLeft className="h-3 w-3" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
