'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, CreditCard, Loader2, AlertTriangle, MapPin, Truck, Lock, Tag, X, Gift } from 'lucide-react'
import { useCart } from '@/components/CartContext'
import { computeCartTotals, formatOMR } from '@/lib/store'

const GOVERNORATES = [
  'MUSCAT', 'DHOFAR', 'MUSANDAM', 'BURAIMI', 'DAKHILIYAH',
  'SHARQIYAH', 'WUSTA', 'BATINAH', 'DHAHIRAH'
]
const GOV_LABELS = {
  MUSCAT: 'مسقط', DHOFAR: 'ظفار', MUSANDAM: 'مسندم', BURAIMI: 'البريمي',
  DAKHILIYAH: 'الداخلية', SHARQIYAH: 'الشرقية', WUSTA: 'الوسطى',
  BATINAH: 'الباطنة', DHAHIRAH: 'الظاهرة',
}

export default function CheckoutClient({ tier, user }) {
  const router = useRouter()
  const { items, clear } = useCart()
  const totals = computeCartTotals({ items, tier })

  const [addr, setAddr] = useState({
    name: user.name || '',
    phone: user.phone || '',
    governorate: 'MUSCAT',
    city: '',
    addressLine: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [coupon, setCoupon] = useState(null) // {code, couponDiscountAmount, finalTotal, ...}
  const [couponError, setCouponError] = useState('')

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) { setCouponError('أدخل رمز الكوبون'); return }
    setApplying(true); setCouponError('')
    try {
      const r = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: totals.subtotal }),
      })
      const d = await r.json()
      if (!r.ok || !d.valid) {
        setCouponError(d.error || 'الكوبون غير صحيح')
        setCoupon(null)
      } else {
        setCoupon(d)
        setCouponError('')
      }
    } catch (e) {
      setCouponError('تعذّر الاتصال، حاول مرة أخرى')
    } finally {
      setApplying(false)
    }
  }
  const removeCoupon = () => {
    setCoupon(null); setCouponInput(''); setCouponError('')
  }

  // Shipping state — fetched whenever governorate or totals change
  const [shipping, setShipping] = useState({ fee: 0, isFree: false, freeThreshold: 30, freeThresholdReached: false })
  const amountForShipping = coupon ? coupon.finalTotal : totals.totalPaid

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const r = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ governorate: addr.governorate, amount: amountForShipping }),
        })
        const d = await r.json()
        if (!ignore && r.ok) setShipping(d)
      } catch (e) { /* noop */ }
    })()
    return () => { ignore = true }
  }, [addr.governorate, amountForShipping])

  const couponDiscount = coupon ? coupon.couponDiscountAmount : 0
  const finalTotal = +(amountForShipping + (shipping.fee || 0)).toFixed(3)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!addr.name || !addr.phone || !addr.addressLine) {
      return setError('الاسم والهاتف والعنوان حقول مطلوبة')
    }
    if (items.length === 0) return setError('السلة فارغة')
    setLoading(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        shippingAddress: addr,
        couponCode: coupon ? coupon.code : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'تعذّر إتمام الطلب')
      return
    }
    clear()
    setSuccess(data.order)
  }

  if (success) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">تم تأكيد طلبك بنجاح!</h1>
        <p className="mt-1 text-sm text-gray-600">سيتم التواصل معك من البائع لتنسيق الشحن.</p>
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 text-right">
          <div className="text-sm"><b>رقم الطلب:</b> <span dir="ltr" className="text-xs text-gray-600">{success.id}</span></div>
          <div className="text-sm"><b>المدفوع:</b> {formatOMR(success.totalPaid)} ر.ع</div>
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">طلباتي</Link>
          <Link href="/store" className="rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white">مواصلة التسوّق</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#1B3A6B]">السلة فارغة</h1>
        <Link href="/store" className="mt-4 inline-flex rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white">المتجر</Link>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <h1 className="mb-6 text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">إتمام الطلب</h1>
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Shipping */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#1B3A6B]" />
                <h2 className="text-sm font-bold text-[#1B3A6B]">عنوان الشحن</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="الاسم الكامل" value={addr.name} onChange={(v) => setAddr({ ...addr, name: v })} required />
                <Input label="الهاتف" value={addr.phone} onChange={(v) => setAddr({ ...addr, phone: v })} required dir="ltr" />
                <Select
                  label="المحافظة"
                  value={addr.governorate}
                  onChange={(v) => setAddr({ ...addr, governorate: v })}
                  options={GOVERNORATES.map((g) => ({ value: g, label: GOV_LABELS[g] }))}
                />
                <Input label="المدينة" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} />
                <div className="sm:col-span-2">
                  <Input
                    label="العنوان التفصيلي"
                    value={addr.addressLine}
                    onChange={(v) => setAddr({ ...addr, addressLine: v })}
                    required
                    placeholder="الحي، الشارع، رقم المبنى..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input label="ملاحظات" value={addr.notes} onChange={(v) => setAddr({ ...addr, notes: v })} />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#1B3A6B]" />
                <h2 className="text-sm font-bold text-[#1B3A6B]">طريقة الدفع</h2>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#1B3A6B] bg-[#1B3A6B]/5 p-3">
                <input type="radio" defaultChecked className="h-4 w-4 accent-[#1B3A6B]" />
                <div>
                  <div className="text-sm font-bold text-[#1B3A6B]">دفع تجريبي (Mock)</div>
                  <div className="text-[11px] text-gray-500">سيتم تفعيل بوابة Thawani / Stripe قريباً</div>
                </div>
              </label>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-gray-500">
                <Lock className="h-3 w-3" /> المعاملات محمية ومشفّرة
              </div>
            </section>
          </div>

          {/* Summary */}
          <div className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="mb-3 text-sm font-bold text-[#1B3A6B]">ملخص الطلب ({items.length} منتج)</h2>
            <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto text-xs">
              {items.map((it) => (
                <li key={it.productId} className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1">{it.nameAr} × {it.quantity}</span>
                  <span className="flex-shrink-0 font-semibold text-[#1B3A6B]">
                    {formatOMR(it.unitPrice * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-gray-200 pt-3 text-sm">
              <SumRow label="المجموع الفرعي" value={`${formatOMR(totals.subtotal)} ر.ع`} />
              {totals.discountPercent > 0 && (
                <SumRow
                  label={`خصم العضوية ${totals.discountPercent}%`}
                  value={`− ${formatOMR(totals.discountAmount)} ر.ع`}
                  color="text-green-600"
                />
              )}
              {coupon && (
                <SumRow
                  label={`كوبون ${coupon.code}`}
                  value={`− ${formatOMR(couponDiscount)} ر.ع`}
                  color="text-amber-600"
                />
              )}
              <SumRow
                label="الشحن"
                value={
                  shipping.isFree
                    ? 'مجاني 🎉'
                    : `${formatOMR(shipping.fee)} ر.ع`
                }
                color={shipping.isFree ? 'text-green-600' : 'text-gray-700'}
              />
              <SumRow
                label="الإجمالي"
                value={`${formatOMR(finalTotal)} ر.ع`}
                bold
              />
            </div>

            {/* Free shipping progress hint */}
            {!shipping.isFree && shipping.freeThreshold > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800">
                <div className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" />
                  أضف {formatOMR(shipping.freeThreshold - amountForShipping)} ر.ع للحصول على <b>شحن مجاني</b>!
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, (amountForShipping / shipping.freeThreshold) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Coupon input */}
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#1B3A6B]">
                <Tag className="h-3.5 w-3.5" /> رمز الكوبون
              </div>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2 text-xs">
                  <div className="flex items-center gap-1.5 text-green-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="font-bold">{coupon.code}</span>
                    <span className="text-gray-600">— وفّرت {formatOMR(couponDiscount)} ر.ع</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label="إزالة الكوبون"
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase().slice(0, 32))}
                      placeholder="WELCOME10"
                      dir="ltr"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={applying || !couponInput.trim()}
                      className="rounded-lg bg-[#1B3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
                    >
                      {applying ? '...' : 'تطبيق'}
                    </button>
                  </div>
                  {couponError && (
                    <div className="mt-1.5 text-[11px] font-semibold text-red-600">{couponError}</div>
                  )}
                </>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ المعالجة...</>
              ) : (
                <>تأكيد الطلب - {formatOMR(finalTotal)} ر.ع</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, required, dir, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        dir={dir}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
      />
    </label>
  )
}
function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
function SumRow({ label, value, bold, color }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-base font-extrabold text-[#1B3A6B]' : 'text-gray-700'} ${color || ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
