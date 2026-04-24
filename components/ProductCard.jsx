'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ShoppingBag, Package, Plus, Check } from 'lucide-react'
import { formatOMR, categoryEmoji, categoryLabel } from '@/lib/store'
import { useCart } from '@/components/CartContext'

export default function ProductCard({ product }) {
  const { addItem, hydrated } = useCart()
  const [added, setAdded] = useState(false)
  const outOfStock = (product.stock || 0) <= 0
  const img = (product.images && product.images[0]) || ''

  const onAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  return (
    <Link
      href={`/store/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-bl from-[#F8F9FA] to-white">
        {img ? (
          <img
            src={img}
            alt={product.nameAr}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl opacity-60">
            {categoryEmoji(product.category)}
          </div>
        )}
        {outOfStock && (
          <span className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            نفد المخزون
          </span>
        )}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-gray-700 shadow-sm">
          {categoryEmoji(product.category)} {categoryLabel(product.category)}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-bold leading-snug text-[#1B3A6B] group-hover:text-[#152c52]">
          {product.nameAr}
        </h3>
        {product.vendorName && (
          <div className="mt-0.5 truncate text-[11px] text-gray-500">
            <Package className="me-1 inline-block h-3 w-3" />
            {product.vendorSlug ? (
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.location.href = `/store/vendor/${encodeURIComponent(product.vendorSlug)}`
                }}
                className="cursor-pointer hover:text-[#1B3A6B] hover:underline"
              >
                {product.vendorName}
              </span>
            ) : (
              product.vendorName
            )}
          </div>
        )}

        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-base font-extrabold text-[#1B3A6B]">
              {formatOMR(product.price)}
              <span className="ms-1 text-[10px] font-medium text-gray-500">ر.ع</span>
            </div>
          </div>
          <button
            onClick={onAdd}
            disabled={!hydrated || outOfStock}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold shadow-sm transition ${
              added
                ? 'bg-green-600 text-white'
                : 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" /> أُضيف
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> للسلة
              </>
            )}
          </button>
        </div>
      </div>
    </Link>
  )
}
