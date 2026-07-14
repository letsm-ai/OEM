'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Users,
  Building2,
  UserCheck,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
} from 'lucide-react'

const TABS = [
  { key: 'testdata', label: 'بيانات الاختبار', icon: FlaskConical },
  { key: 'users', label: 'المستخدمون', icon: Users },
  { key: 'companies', label: 'الشركات', icon: Building2 },
  { key: 'experts', label: 'الخبراء', icon: UserCheck },
  { key: 'products', label: 'المنتجات', icon: Package },
]

export default function CleanupClient() {
  const [activeTab, setActiveTab] = useState('testdata')
  const [globalError, setGlobalError] = useState('')

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            تنظيف البيانات
          </h1>
          <p className="text-sm text-gray-500">
            احذف البيانات التجريبية دفعة واحدة، أو تصفح واحذف أي عنصر بشكل مفرد.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-gray-50 p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-[#1B3A6B] shadow-sm'
                  : 'text-gray-500 hover:bg-white/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>

      {globalError && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900">خطأ</AlertTitle>
          <AlertDescription className="text-red-800">{globalError}</AlertDescription>
        </Alert>
      )}

      {activeTab === 'testdata' ? (
        <TestDataPanel onError={setGlobalError} />
      ) : (
        <BrowsePanel type={activeTab} onError={setGlobalError} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BULK TEST-DATA CLEANUP (original behavior)                        */
/* ------------------------------------------------------------------ */
function TestDataPanel({ onError }) {
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    onError('')
    try {
      const res = await fetch('/api/admin/cleanup/scan')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SCAN_FAILED')
      setScan(data)
    } catch (e) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const execute = async () => {
    setDeleting(true)
    onError('')
    try {
      const res = await fetch('/api/admin/cleanup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE-TEST-DATA' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'DELETE_FAILED')
      setResult(data)
      setConfirmOpen(false)
      load()
    } catch (e) {
      onError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Alert className="mb-4 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertTitle className="text-amber-900">حذف جماعي — بيانات الاختبار فقط</AlertTitle>
        <AlertDescription className="text-amber-800 text-xs leading-relaxed">
          يحذف كل مستخدم إيميله يطابق أنماط الاختبار (@x.com، @test.*، @example.*، .test، @localhost، @resend-test.*) مع كل بياناته المرتبطة (منتجات، طلبات، شركات، اشتراكات، حجوزات، تقييمات، سلة، مفضلة). العملية غير قابلة للتراجع.
        </AlertDescription>
      </Alert>

      {result && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-900">تم الحذف بنجاح</AlertTitle>
          <AlertDescription className="text-emerald-800 text-xs">
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
              {Object.entries(result.deleted || {}).map(([k, v]) => v > 0 && (
                <div key={k} className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-gray-600">{k}</span>
                  <span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ما سيتم حذفه</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ الفحص...
            </div>
          ) : scan ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['المستخدمون', scan.totals.users, 'text-red-600'],
                  ['المنتجات', scan.totals.products, 'text-orange-600'],
                  ['الطلبات', scan.totals.orders, 'text-amber-600'],
                  ['الشركات', scan.totals.companies, 'text-cyan-700'],
                  ['الخبراء', scan.totals.experts, 'text-indigo-600'],
                  ['الاشتراكات', scan.totals.memberships, 'text-emerald-600'],
                  ['الحجوزات', scan.totals.appointments, 'text-purple-600'],
                  ['طلبات البائع', scan.totals.vendorApplications, 'text-pink-600'],
                ].map(([label, val, color]) => (
                  <div key={label} className="rounded-lg border bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500">{label}</div>
                    <div className={`mt-1 text-2xl font-extrabold ${color}`}>{val}</div>
                  </div>
                ))}
              </div>

              {scan.users.length === 0 && (
                <div className="mt-6 rounded-lg border bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-2 font-semibold text-emerald-900">
                    لا توجد بيانات تجريبية للحذف
                  </p>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {scan?.totals?.users > 0 && (
        <div className="flex justify-end">
          <Button variant="destructive" size="lg" onClick={() => setConfirmOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            حذف كل البيانات التجريبية ({scan.totals.users} مستخدم)
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription className="text-red-700">
              أنت على وشك حذف <strong>{scan?.totals?.users || 0} مستخدم</strong> مع كل بياناتهم المرتبطة. العملية غير قابلة للتراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={execute} disabled={deleting}>
              {deleting ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جارٍ الحذف...</> : <><Trash2 className="ml-2 h-4 w-4" />نعم، احذف الآن</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  INDIVIDUAL BROWSE + DELETE                                         */
/* ------------------------------------------------------------------ */
function BrowsePanel({ type, onError }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [confirmItem, setConfirmItem] = useState(null) // item pending delete
  const [deleting, setDeleting] = useState(false)
  const [flash, setFlash] = useState(null) // last delete result
  const searchTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    onError('')
    try {
      const params = new URLSearchParams({
        type,
        page: String(page),
        limit: '20',
      })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/cleanup/browse?${params}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || d.error || 'BROWSE_FAILED')
      setData(d)
    } catch (e) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }, [type, page, q, onError])

  // Reset when type changes
  useEffect(() => {
    setQ('')
    setPage(1)
    setFlash(null)
  }, [type])

  // Load on filter change (debounce search input)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(), 250)
    return () => searchTimer.current && clearTimeout(searchTimer.current)
  }, [load])

  const deleteItem = async () => {
    if (!confirmItem) return
    setDeleting(true)
    onError('')
    try {
      const res = await fetch('/api/admin/cleanup/entity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          id: confirmItem.id,
          confirm: 'DELETE-ENTITY',
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || d.error || 'DELETE_FAILED')
      setFlash({ msg: d.message, deleted: d.deleted })
      setConfirmItem(null)
      load()
      setTimeout(() => setFlash(null), 6000)
    } catch (e) {
      onError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {flash && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-900">تم الحذف</AlertTitle>
          <AlertDescription className="text-emerald-800 text-xs">
            {flash.msg}
            {flash.deleted && Object.keys(flash.deleted).length > 0 && (
              <div className="mt-1 text-[11px] text-gray-600">
                ({Object.entries(flash.deleted).filter(([_, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(', ')})
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {TABS.find((t) => t.key === type)?.label} ({data.total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }}
                placeholder="بحث..."
                className="w-full pr-9 sm:w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-lg border bg-gray-50 p-6 text-center text-sm text-gray-500">
              لا توجد نتائج{q ? ` لبحث: "${q}"` : ''}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-right text-xs text-gray-500">
                  <tr>
                    {type === 'users' && (
                      <>
                        <th className="px-3 py-2">الإيميل</th>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">الدور</th>
                        <th className="px-3 py-2">الباقة</th>
                        <th className="px-3 py-2">مرتبطات</th>
                      </>
                    )}
                    {type === 'companies' && (
                      <>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">القطاع</th>
                        <th className="px-3 py-2">المحافظة</th>
                        <th className="px-3 py-2">الحالة</th>
                      </>
                    )}
                    {type === 'experts' && (
                      <>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">التخصص</th>
                        <th className="px-3 py-2">السعر</th>
                        <th className="px-3 py-2">الحجوزات</th>
                      </>
                    )}
                    {type === 'products' && (
                      <>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">السعر</th>
                        <th className="px-3 py-2">المخزون</th>
                        <th className="px-3 py-2">مرتبطات</th>
                      </>
                    )}
                    <th className="px-3 py-2 text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <ItemRow key={it.id} item={it} type={type} onDelete={() => setConfirmItem(it)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-600">
                صفحة {page} من {data.pages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmItem} onOpenChange={(o) => !o && setConfirmItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription className="text-red-700">
              {confirmItem && renderDeleteWarning(confirmItem, type)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmItem(null)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteItem} disabled={deleting}>
              {deleting ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جارٍ الحذف...</> : <><Trash2 className="ml-2 h-4 w-4" />نعم، احذف</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ItemRow({ item, type, onDelete }) {
  const del = (
    <Button variant="destructive" size="sm" onClick={onDelete} disabled={item.isSelf} title={item.isSelf ? 'لا يمكنك حذف نفسك' : 'حذف'}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )

  if (type === 'users') {
    return (
      <tr className="border-t hover:bg-gray-50">
        <td className="px-3 py-2 font-mono text-[11px]">
          {item.email}
          {item.isSelf && <Badge variant="outline" className="mx-1 text-[9px]">أنت</Badge>}
        </td>
        <td className="px-3 py-2 text-xs">{item.name || '—'}</td>
        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{item.role}</Badge></td>
        <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{item.tier}</Badge></td>
        <td className="px-3 py-2 text-[10px] text-gray-500">
          {item.refs?.products > 0 && <span className="mx-0.5">🛍️{item.refs.products}</span>}
          {item.refs?.orders > 0 && <span className="mx-0.5">📦{item.refs.orders}</span>}
          {item.refs?.companies > 0 && <span className="mx-0.5">🏢{item.refs.companies}</span>}
          {item.refs?.expertProfile > 0 && <span className="mx-0.5">👨‍💼{item.refs.expertProfile}</span>}
          {item.refs?.memberships > 0 && <span className="mx-0.5">👑{item.refs.memberships}</span>}
        </td>
        <td className="px-3 py-2 text-left">{del}</td>
      </tr>
    )
  }
  if (type === 'companies') {
    return (
      <tr className="border-t hover:bg-gray-50">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {item.logo && <img src={item.logo} alt="" className="h-6 w-6 rounded object-cover" />}
            <span className="text-xs font-semibold">{item.nameAr}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs">{item.sector}</td>
        <td className="px-3 py-2 text-xs">{item.governorate}</td>
        <td className="px-3 py-2">
          {item.featured && <Badge className="mx-0.5 bg-amber-500 text-[10px]">ذهبي</Badge>}
          {item.verified && <Badge className="mx-0.5 bg-emerald-500 text-[10px]">موثّق</Badge>}
        </td>
        <td className="px-3 py-2 text-left">{del}</td>
      </tr>
    )
  }
  if (type === 'experts') {
    return (
      <tr className="border-t hover:bg-gray-50">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {item.photo && <img src={item.photo} alt="" className="h-6 w-6 rounded-full object-cover" />}
            <span className="text-xs font-semibold">{item.nameAr}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs">{item.specialty}</td>
        <td className="px-3 py-2 text-xs">{item.hourlyRate} ر.ع</td>
        <td className="px-3 py-2 text-xs">{item.refs?.bookings || 0}</td>
        <td className="px-3 py-2 text-left">{del}</td>
      </tr>
    )
  }
  if (type === 'products') {
    return (
      <tr className="border-t hover:bg-gray-50">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {item.image && <img src={item.image} alt="" className="h-6 w-6 rounded object-cover" />}
            <span className="text-xs font-semibold">{item.nameAr}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs">{item.price} ر.ع</td>
        <td className="px-3 py-2 text-xs">{item.stock}</td>
        <td className="px-3 py-2 text-[10px] text-gray-500">
          {item.refs?.orderedTimes > 0 && <span className="mx-0.5">📦{item.refs.orderedTimes}</span>}
          {item.refs?.reviews > 0 && <span className="mx-0.5">⭐{item.refs.reviews}</span>}
        </td>
        <td className="px-3 py-2 text-left">{del}</td>
      </tr>
    )
  }
  return null
}

function renderDeleteWarning(item, type) {
  if (type === 'users') {
    const bits = []
    if (item.refs?.products > 0) bits.push(`${item.refs.products} منتج`)
    if (item.refs?.orders > 0) bits.push(`${item.refs.orders} طلب`)
    if (item.refs?.companies > 0) bits.push(`${item.refs.companies} شركة`)
    if (item.refs?.expertProfile > 0) bits.push('ملف خبير')
    if (item.refs?.memberships > 0) bits.push(`${item.refs.memberships} اشتراك`)
    return (
      <>
        سيتم حذف حساب <strong>{item.email}</strong>
        {bits.length > 0 && <> مع بياناته المرتبطة: <strong>{bits.join('، ')}</strong></>}.
        العملية غير قابلة للتراجع.
      </>
    )
  }
  if (type === 'companies') {
    return <>سيتم حذف الشركة <strong>{item.nameAr}</strong> نهائياً من الدليل. العملية غير قابلة للتراجع.</>
  }
  if (type === 'experts') {
    const b = item.refs?.bookings > 0 ? ` (${item.refs.bookings} حجز مرتبط)` : ''
    return <>سيتم حذف ملف الخبير <strong>{item.nameAr}</strong>{b}. العملية غير قابلة للتراجع.</>
  }
  if (type === 'products') {
    const b = []
    if (item.refs?.orderedTimes > 0) b.push(`${item.refs.orderedTimes} طلب`)
    if (item.refs?.reviews > 0) b.push(`${item.refs.reviews} تقييم`)
    return (
      <>
        سيتم حذف المنتج <strong>{item.nameAr}</strong>
        {b.length > 0 && <> مع بياناته المرتبطة: <strong>{b.join('، ')}</strong></>}.
        العملية غير قابلة للتراجع.
      </>
    )
  }
  return null
}
