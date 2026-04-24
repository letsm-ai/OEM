'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  CheckCircle2,
  Truck,
  Home,
  XCircle,
  Loader2,
  ShoppingBag,
  Clock,
  Copy,
} from 'lucide-react'
import { formatOMR } from '@/lib/store'

const STATUS_META = {
  PENDING: { label: 'قيد الدفع', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  PAID: { label: 'تم الدفع', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle2 },
  SHIPPED: { label: 'تم الشحن', color: 'text-amber-600', bg: 'bg-amber-50', icon: Truck },
  DELIVERED: { label: 'تم التسليم', color: 'text-green-600', bg: 'bg-green-50', icon: Home },
  CANCELLED: { label: 'ملغي', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  FAILED: { label: 'فشل الدفع', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
}

const TIMELINE_STEPS = [
  { key: 'PAID', label: 'تم الدفع', icon: CheckCircle2 },
  { key: 'SHIPPED', label: 'تم الشحن', icon: Truck },
  { key: 'DELIVERED', label: 'تم التسليم', icon: Home },
]

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.PENDING
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${m.bg} ${m.color} px-2.5 py-0.5 text-xs font-bold`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  )
}

function Timeline({ order }) {
  const history = order.statusHistory || []
  // Map: for each step key, find its history entry or null
  const byStatus = Object.fromEntries(history.map((h) => [h.status, h]))
  // Determine reached index
  const reachedIdx =
    order.status === 'DELIVERED' ? 2 :
    order.status === 'SHIPPED' ? 1 :
    order.status === 'PAID' ? 0 : -1
  const isCancelled = order.status === 'CANCELLED' || order.status === 'FAILED'

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
        <XCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <div className="text-sm font-bold text-red-700">
          {order.status === 'CANCELLED' ? 'تم إلغاء الطلب' : 'فشل الدفع'}
        </div>
      </div>
    )
  }

  return (
    <div className="relative py-2">
      {/* Connector line */}
      <div className="absolute top-[26px] right-[40px] left-[40px] h-0.5 bg-gray-200" />
      <div
        className="absolute top-[26px] right-[40px] h-0.5 bg-[#1B3A6B] transition-all duration-500"
        style={{ width: reachedIdx >= 0 ? `calc((100% - 80px) * ${reachedIdx / (TIMELINE_STEPS.length - 1)})` : '0' }}
      />

      <div className="relative flex items-start justify-between">
        {TIMELINE_STEPS.map((step, idx) => {
          const Icon = step.icon
          const reached = idx <= reachedIdx
          const h = byStatus[step.key]
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center px-2 text-center">
              <div
                className={`z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
                  reached
                    ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className={`mt-2 text-xs font-bold ${reached ? 'text-[#1B3A6B]' : 'text-gray-400'}`}>
                {step.label}
              </div>
              {h && (
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {new Date(h.changedAt).toLocaleDateString('ar-OM', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrdersClient() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/orders')
        const d = await r.json()
        if (!cancelled) setOrders(d.orders || [])
      } catch (e) { /* noop */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const copy = (text) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="bg-[#F8F9FA] py-8 min-h-[70vh]">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-[#1B3A6B]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#1B3A6B]">طلباتي</h1>
              <p className="text-sm text-gray-500">
                {loading ? '...' : `${orders.length} ${orders.length === 1 ? 'طلب' : 'طلبات'} مسجّلة`}
              </p>
            </div>
          </div>
          <Link href="/store" className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#b89440]">
            <ShoppingBag className="h-4 w-4" />
            متابعة التسوق
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <div className="mb-1 text-lg font-bold text-gray-700">لا توجد طلبات بعد</div>
            <p className="mb-5 text-sm text-gray-500">ابدأ التسوق من المتجر وستظهر طلباتك هنا</p>
            <Link href="/store" className="inline-flex items-center gap-2 rounded-xl bg-[#1B3A6B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]">
              <ShoppingBag className="h-4 w-4" />
              ابدأ التسوق
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((o) => (
              <div key={o.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gradient-to-l from-[#F8F9FA] to-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B3A6B]/10 text-[#1B3A6B]">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        طلب <span dir="ltr" className="font-mono">{String(o.id).slice(0, 8)}</span>
                        <button onClick={() => copy(o.id)} title="نسخ" className="rounded p-0.5 hover:bg-gray-200">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(o.createdAt).toLocaleString('ar-OM', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-gray-500">الإجمالي</div>
                      <div className="text-base font-extrabold text-[#1B3A6B]">{formatOMR(o.totalPaid || 0)} ر.ع</div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <Timeline order={o} />

                  {o.trackingNumber && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs">
                      <Truck className="h-4 w-4 text-amber-600" />
                      <span className="text-gray-700">رقم التتبّع:</span>
                      <code dir="ltr" className="flex-1 rounded bg-white px-2 py-1 font-mono text-amber-800">
                        {o.trackingNumber}
                      </code>
                      {o.carrier && <span className="font-semibold text-gray-600">{o.carrier}</span>}
                      <button onClick={() => copy(o.trackingNumber)} className="rounded p-1 hover:bg-amber-100">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Items preview */}
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-bold text-gray-700">المنتجات ({(o.items || []).reduce((s, it) => s + it.quantity, 0)} قطعة)</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(o.items || []).map((it, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-white">
                            {it.image ? (
                              <img src={it.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-semibold text-gray-800">{it.nameAr}</div>
                            <div className="text-[10px] text-gray-500">
                              {it.quantity} × {formatOMR(it.unitPrice)} ر.ع
                            </div>
                          </div>
                          <div className="font-bold text-[#1B3A6B]">{formatOMR(it.lineSubtotal)} ر.ع</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping address */}
                  {o.shippingAddress?.addressLine && (
                    <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs">
                      <div className="mb-1 font-bold text-gray-700">عنوان التوصيل</div>
                      <div className="text-gray-600">
                        {o.shippingAddress.name} — {o.shippingAddress.phone}
                        <br />
                        {o.shippingAddress.addressLine}{o.shippingAddress.city && ` ، ${o.shippingAddress.city}`}
                      </div>
                    </div>
                  )}

                  {/* History log */}
                  {(o.statusHistory || []).length > 0 && (
                    <details className="mt-4 text-xs">
                      <summary className="cursor-pointer font-bold text-gray-700 hover:text-[#1B3A6B]">
                        📜 سجلّ التحديثات ({(o.statusHistory || []).length})
                      </summary>
                      <div className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-3">
                        {[...(o.statusHistory || [])].reverse().map((h, i) => {
                          const m = STATUS_META[h.status] || STATUS_META.PENDING
                          return (
                            <div key={i} className="flex items-start gap-2 text-[11px]">
                              <span className={`rounded-full ${m.bg} ${m.color} px-2 py-0.5 font-bold`}>{m.label}</span>
                              <div className="flex-1">
                                <div className="text-gray-700">{h.actorName || 'نظام'}</div>
                                <div className="text-gray-400">
                                  {new Date(h.changedAt).toLocaleString('ar-OM', { dateStyle: 'medium', timeStyle: 'short' })}
                                </div>
                                {h.note && <div className="mt-0.5 italic text-gray-600">{h.note}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
