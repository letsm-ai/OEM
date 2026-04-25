'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Check, Star, Heart } from 'lucide-react'
import { formatOMR, categoryEmoji } from '@/lib/store'
import { useCart } from '@/components/CartContext'
import { useWishlist } from '@/components/WishlistContext'

export default function ProductCard({ product }) {
  const router = useRouter()
  const { addItem, hydrated } = useCart()
  const { has, toggle } = useWishlist()
  const [added, setAdded] = useState(false)
  const outOfStock = (product.stock || 0) <= 0
  const img = (product.images && product.images[0]) || ''
  const rating = Number(product.rating || 0)
  const reviewCount = Number(product.reviewCount || 0)
  const isFav = has(product.id)

  const onToggleFav = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const r = await toggle(product.id)
    if (!r.ok && r.needLogin) {
      router.push(`/login?callbackUrl=/store/${product.id}`)
    }
  }

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
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-bl from-[#F8F9FA] to-white">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={product.nameAr}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-60">
            {categoryEmoji(product.category)}
          </div>
        )}
        {outOfStock && (
          <span className="absolute top-1 right-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            نفد
          </span>
        )}
        <button
          onClick={onToggleFav}
          aria-label={isFav ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
          className={`absolute top-1 left-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110 ${
            isFav ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isFav ? 'fill-red-500' : ''}`} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        <h3 className="line-clamp-2 min-h-[2.2em] text-[12px] font-bold leading-tight text-[#1B3A6B] group-hover:text-[#152c52]">
          {product.nameAr}
        </h3>

        {reviewCount > 0 && (
          <div className="flex items-center gap-0.5 text-[10px]">
            <Star className="h-2.5 w-2.5 fill-[#C9A84C] text-[#C9A84C]" />
            <span className="font-semibold text-gray-700">{rating.toFixed(1)}</span>
            <span className="text-gray-400">({reviewCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-1 pt-1">
          <div className="text-sm font-extrabold leading-none text-[#1B3A6B]">
            {formatOMR(product.price)}
            <span className="ms-0.5 text-[9px] font-medium text-gray-500">ر.ع</span>
          </div>
          <button
            onClick={onAdd}
            disabled={!hydrated || outOfStock}
            aria-label="أضف إلى السلة"
            title="أضف إلى السلة"
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
              added
                ? 'bg-green-600 text-white'
                : 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </Link>
  )
}
