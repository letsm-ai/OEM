'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Download,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Mail,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react'

const SOURCE_LABEL = {
  'one-click': { text: 'زر Gmail (واحدة)', className: 'bg-purple-100 text-purple-700' },
  'landing-page': { text: 'صفحة الموقع', className: 'bg-blue-100 text-blue-700' },
  admin: { text: 'يدوي (أدمن)', className: 'bg-amber-100 text-amber-700' },
  bounce: { text: 'إرتداد', className: 'bg-red-100 text-red-700' },
  complaint: { text: 'شكوى', className: 'bg-rose-100 text-rose-700' },
}

export default function OptOutClient() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [confirm, setConfirm] = useState(null) // {id, email}

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search.trim()) qs.set('search', search.trim())
      if (source) qs.set('source', source)
      const res = await fetch(`/api/admin/email-optouts?${qs.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'تعذّر تحميل القائمة')
        setItems([])
        return
      }
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (e) {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, source])

  useEffect(() => {
    load()
  }, [load])

  const doDelete = async (id) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/email-optouts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'فشل الحذف')
        return
      }
      setConfirm(null)
      await load()
    } catch (e) {
      alert('تعذّر الاتصال بالخادم')
    } finally {
      setDeletingId('')
    }
  }

  const exportCsv = () => {
    // Simple GET download
    window.location.href = '/api/admin/email-optouts/export'
  }

  const formatDate = (v) => {
    if (!v) return '—'
    try {
      return new Date(v).toLocaleString('ar-OM', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return String(v)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="بحث بالبريد..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-3 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/20"
            />
          </div>
          <select
            value={source}
            onChange={(e) => {
              setPage(1)
              setSource(e.target.value)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          >
            <option value="">جميع المصادر</option>
            <option value="one-click">زر Gmail</option>
            <option value="landing-page">صفحة الموقع</option>
            <option value="admin">أدمن</option>
            <option value="bounce">إرتداد</option>
            <option value="complaint">شكوى</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={exportCsv}
            disabled={total === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-3 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
        الإجمالي: <span className="font-bold text-[#1B3A6B]">{total}</span> متلقٍّ ألغوا الاشتراك
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F8F9FA] text-xs font-bold text-gray-600">
              <tr>
                <th className="px-4 py-3">البريد</th>
                <th className="px-4 py-3">المصدر</th>
                <th className="px-4 py-3">السبب</th>
                <th className="px-4 py-3">تاريخ الإلغاء</th>
                <th className="px-4 py-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1B3A6B]" />
                    <div className="mt-2 text-xs text-gray-500">جارٍ التحميل...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Mail className="mx-auto h-8 w-8 text-gray-300" />
                    <div className="mt-2 text-sm text-gray-500">لا توجد إلغاءات اشتراك بعد</div>
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const src = SOURCE_LABEL[r.source] || {
                    text: r.source,
                    className: 'bg-gray-100 text-gray-700',
                  }
                  return (
                    <tr key={r.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-4 py-3" dir="ltr">
                        <span className="font-mono text-sm text-gray-800">{r.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${src.className}`}>
                          {src.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="max-w-xs truncate" title={r.reason}>
                          {r.reason || '—'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setConfirm({ id: r.id, email: r.email })}
                          disabled={deletingId === r.id}
                          title="إعادة الاشتراك (حذف من القائمة)"
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          إعادة الاشتراك
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-[#F8F9FA] px-4 py-3 text-sm">
            <div className="text-xs text-gray-500">
              صفحة {page} من {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="rounded-lg border border-gray-300 bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="rounded-lg border border-gray-300 bg-white p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm re-subscribe modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B3A6B]">إعادة الاشتراك</h3>
              <button
                onClick={() => setConfirm(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-sm text-gray-600">
              هل أنت متأكد من حذف <span className="font-mono font-semibold text-[#1B3A6B]">{confirm.email}</span> من قائمة الإلغاء؟ سيتم إعادة تفعيل الرسائل الترويجية له.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => doDelete(confirm.id)}
                disabled={deletingId === confirm.id}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {deletingId === confirm.id ? 'جارٍ الحذف...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
