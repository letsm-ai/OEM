'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  ShoppingCart,
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Power,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Truck,
  Store,
  X,
  Upload,
  ImageIcon,
} from 'lucide-react'
import {
  PRODUCT_CATEGORIES,
  formatOMR,
  categoryLabel,
  categoryEmoji,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE,
  COMMISSION_PERCENT,
} from '@/lib/store'

export default function VendorDashboardClient() {
  const [tab, setTab] = useState('products')
  return (
    <div className="bg-[#F8F9FA] py-6">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center gap-2">
          <Store className="h-6 w-6 text-[#1B3A6B]" />
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">لوحة البائع</h1>
        </div>

        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <TabBtn active={tab === 'products'} onClick={() => setTab('products')} icon={<Package className="h-4 w-4" />} label="منتجاتي" />
          <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingCart className="h-4 w-4" />} label="الطلبات" />
          <TabBtn active={tab === 'earnings'} onClick={() => setTab('earnings')} icon={<Wallet className="h-4 w-4" />} label="الأرباح" />
        </div>

        {tab === 'products' && <ProductsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'earnings' && <EarningsTab />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-[#1B3A6B] text-white shadow' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/* --------------- PRODUCTS --------------- */
function ProductsTab() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/products')
    const d = await r.json()
    setProducts(d.products || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const onDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    load()
  }
  const onToggleActive = async (p) => {
    await fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">{products.length} منتج</div>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
        >
          <Plus className="h-4 w-4" /> إضافة منتج
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          لم تضف أي منتجات بعد، ابدأ بإضافة منتج.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">{categoryEmoji(p.category)}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <div className="line-clamp-1 text-sm font-bold text-[#1B3A6B]">{p.nameAr}</div>
                  {!p.isActive && (
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-700">مُعطّل</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">{categoryLabel(p.category)}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="font-extrabold text-[#1B3A6B]">{formatOMR(p.price)} ر.ع</span>
                  <span className="text-gray-400">•</span>
                  <span>المخزون: {p.stock}</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50"
                    title="تعديل"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onToggleActive(p)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50"
                    title={p.isActive ? 'تعطيل' : 'تفعيل'}
                  >
                    <Power className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                    title="حذف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductFormModal
          product={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    nameAr: product?.nameAr || '',
    nameEn: product?.nameEn || '',
    description: product?.description || '',
    price: product?.price ?? '',
    category: product?.category || 'OTHER',
    stock: product?.stock ?? 0,
    images: product?.images || [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - form.images.length)
    const promises = files.map(
      (f) => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            const scale = Math.min(1, 800 / Math.max(img.width, img.height))
            const c = document.createElement('canvas')
            c.width = img.width * scale
            c.height = img.height * scale
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
            res(c.toDataURL('image/jpeg', 0.85))
          }
          img.onerror = rej
          img.src = reader.result
        }
        reader.onerror = rej
        reader.readAsDataURL(f)
      })
    )
    try {
      const urls = await Promise.all(promises)
      setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, 5) }))
    } catch {
      setError('تعذرت قراءة الصورة')
    }
    e.target.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nameAr.trim()) return setError('اسم المنتج مطلوب')
    const price = Number(form.price)
    if (!Number.isFinite(price) || price < 0) return setError('السعر غير صحيح')
    setLoading(true)
    const res = await fetch(product ? `/api/products/${product.id}` : '/api/products', {
      method: product ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(data.error || 'خطأ')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-bold text-[#1B3A6B]">{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="الاسم (عربي) *">
              <input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" />
            </F>
            <F label="الاسم (إنجليزي)">
              <input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="input text-right" />
            </F>
            <F label="السعر (ر.ع) *">
              <input required type="number" step="0.001" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" />
            </F>
            <F label="الكمية في المخزون">
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" />
            </F>
            <F label="الفئة">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </F>
          </div>
          <F label="الوصف">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-none" />
          </F>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-700">الصور ({form.images.length}/5)</div>
            <div className="grid grid-cols-5 gap-2">
              {form.images.map((img, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} className="absolute top-1 left-1 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {form.images.length < 5 && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#1B3A6B] hover:text-[#1B3A6B]">
                  <Upload className="h-5 w-5" />
                  <input type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
                </label>
              )}
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">إلغاء</button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-bold text-white hover:bg-[#152c52] disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {product ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </form>
        <style jsx>{`.input{width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:#1B3A6B;box-shadow:0 0 0 3px rgba(27,58,107,0.1)}`}</style>
      </div>
    </div>
  )
}
function F({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>{children}</label>
}

/* --------------- ORDERS --------------- */
function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/orders')
    const d = await r.json()
    setOrders(d.orders || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    await fetch(`/api/vendor/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
  if (orders.length === 0) return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">لا توجد طلبات بعد</div>

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-gray-500">رقم الطلب: <span dir="ltr" className="text-[10px]">{o.id.slice(0, 8)}</span></div>
              <div className="text-xs text-gray-500">
                {new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(o.createdAt))}
              </div>
            </div>
            <span className={`inline-flex rounded-full px-3 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_BADGE[o.status]}`}>
              {ORDER_STATUS_LABELS[o.status]}
            </span>
          </div>
          <div className="mb-3 text-xs text-gray-600">
            <b>المشتري:</b> {o.buyer?.name} • <span dir="ltr">{o.buyer?.email}</span>
          </div>
          {o.shippingAddress && (
            <div className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
              <div><b>الشحن:</b> {o.shippingAddress.name} • {o.shippingAddress.phone}</div>
              <div>{o.shippingAddress.addressLine}{o.shippingAddress.city && `، ${o.shippingAddress.city}`}</div>
            </div>
          )}
          <div className="space-y-1.5">
            {o.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{it.nameAr} × {it.quantity}</span>
                <span className="font-semibold text-[#1B3A6B]">{formatOMR(it.lineSubtotal)} ر.ع</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
            <div>
              <div>إجمالي: <b>{formatOMR(o.vendorSubtotal)} ر.ع</b></div>
              <div className="text-red-600">عمولة {COMMISSION_PERCENT}%: − {formatOMR(o.vendorCommission)} ر.ع</div>
              <div className="text-green-700 font-bold">صافي: {formatOMR(o.vendorNet)} ر.ع</div>
            </div>
            <div className="flex gap-1">
              {o.status === 'PAID' && (
                <button onClick={() => updateStatus(o.id, 'SHIPPED')} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700">
                  <Truck className="h-3 w-3" /> شحن
                </button>
              )}
              {o.status === 'SHIPPED' && (
                <button onClick={() => updateStatus(o.id, 'DELIVERED')} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3" /> تسليم
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* --------------- EARNINGS --------------- */
function EarningsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/vendor/orders').then((r) => r.json()).then((d) => {
      setData(d.earnings)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
  if (!data) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="إجمالي المبيعات" value={`${formatOMR(data.totalSales)} ر.ع`} color="from-blue-500 to-blue-700" icon={<ShoppingCart className="h-5 w-5" />} />
      <StatCard label={`عمولة المنصّة (${data.commissionPercent}%)`} value={`− ${formatOMR(data.totalCommission)} ر.ع`} color="from-red-500 to-red-700" icon={<AlertCircle className="h-5 w-5" />} />
      <StatCard label="صافي الأرباح" value={`${formatOMR(data.totalNet)} ر.ع`} color="from-green-600 to-green-800" icon={<Wallet className="h-5 w-5" />} />
      <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        عدد الطلبات: <b>{data.orderCount}</b>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-gradient-to-bl ${color} p-5 text-white`}>
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-white/15 p-1.5">{icon}</span>
        <span className="text-[11px] opacity-80">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold">{value}</div>
    </div>
  )
}
