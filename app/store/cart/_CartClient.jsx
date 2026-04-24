'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Tag } from 'lucide-react'
import { useCart } from '@/components/CartContext'
import {
  computeCartTotals,
  formatOMR,
  TIER_DISCOUNT_PERCENT,
} from '@/lib/store'

export default function CartClient({ tier, authed }) {
  const router = useRouter()
  const { items, updateQuantity, removeItem, hydrated } = useCart()
  const totals = computeCartTotals({ items, tier })

  if (!hydrated) return null

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">سلتك فارغة</h1>
        <p className="mt-1 text-sm text-gray-500">تصفّح المنتجات وأضف ما تعجبك</p>
        <Link
          href="/store"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
        >
          العودة للمتجر
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <h1 className="mb-6 text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
          سلة التسوّق
        </h1>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Items */}
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={`${it.productId}__${it.variantId || ''}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {it.image ? (
                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl opacity-50">🛍️</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/store/${it.productId}`}
                    className="line-clamp-1 text-sm font-bold text-[#1B3A6B] hover:text-[#152c52]"
                  >
                    {it.nameAr}
                  </Link>
                  {it.variantName && (
                    <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[11px] font-semibold text-[#1B3A6B]">
                      {it.variantName}
                    </div>
                  )}
                  {it.vendorName && (
                    <div className="truncate text-[11px] text-gray-500">{it.vendorName}</div>
                  )}
                  <div className="mt-1 text-sm font-extrabold text-[#1B3A6B]">
                    {formatOMR(it.unitPrice)} <span className="text-[10px] font-medium text-gray-500">ر.ع</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(it.productId, it.quantity - 1, it.variantId)}
                    disabled={it.quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 disabled:opacity-40"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <div className="w-10 text-center text-sm font-bold">{it.quantity}</div>
                  <button
                    onClick={() => updateQuantity(it.productId, it.quantity + 1, it.variantId)}
                    disabled={it.quantity >= (it.stock || 999)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={() => removeItem(it.productId, it.variantId)}
                  className="ml-2 rounded-md p-2 text-red-500 hover:bg-red-50"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="mb-4 text-sm font-bold text-[#1B3A6B]">ملخص الطلب</h2>
            <div className="space-y-2 text-sm">
              <Row label="المجموع الفرعي" value={`${formatOMR(totals.subtotal)} ر.ع`} />
              {totals.discountPercent > 0 && (
                <Row
                  label={`خصم العضوية (${totals.discountPercent}%)`}
                  value={`− ${formatOMR(totals.discountAmount)} ر.ع`}
                  color="text-green-600"
                />
              )}
              <div className="my-2 border-t border-gray-200" />
              <Row
                label="الإجمالي"
                value={`${formatOMR(totals.totalPaid)} ر.ع`}
                bold
              />
            </div>

            {tier === 'FREE' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <Tag className="inline-block h-3.5 w-3.5" /> اشترك في عضوية للحصول على خصومات تصل إلى {TIER_DISCOUNT_PERCENT.PLATINUM}%.
                <Link href="/membership" className="mr-1 font-bold underline">تفاصيل</Link>
              </div>
            )}

            <button
              onClick={() => router.push(authed ? '/store/checkout' : '/login?callbackUrl=/store/checkout')}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B3A6B] py-3 text-sm font-semibold text-white hover:bg-[#152c52]"
            >
              متابعة الدفع
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link
              href="/store"
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              مواصلة التسوّق
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, color }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-extrabold text-base text-[#1B3A6B]' : 'text-gray-700'} ${color || ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
