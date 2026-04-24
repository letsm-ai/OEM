'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { Search, ShoppingBag, ShoppingCart, Store as StoreIcon, Heart, Package } from 'lucide-react'
import { PRODUCT_CATEGORIES, categoryLabel, categoryEmoji } from '@/lib/store'
import ProductCard from '@/components/ProductCard'
import { useCart } from '@/components/CartContext'
import { useWishlist } from '@/components/WishlistContext'

export default function StoreClient({ initialProducts }) {
  return (
    <Suspense fallback={null}>
      <StoreInner initialProducts={initialProducts} />
    </Suspense>
  )
}

function StoreInner({ initialProducts }) {
  const router = useRouter()
  const sp = useSearchParams()
  const { totals } = useCart()
  const { count: favCount } = useWishlist()
  const category = sp.get('category') || ''
  const search = sp.get('search') || ''
  const sort = sp.get('sort') || 'newest'

  const setParam = (key, value) => {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`/store?${p.toString()}`)
  }

  const onSearch = (e) => {
    e.preventDefault()
    const v = e.target.elements.q.value.trim()
    setParam('search', v)
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
              <StoreIcon className="h-4 w-4" /> متجر المجلس
            </div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
              تسوّق من رواد الأعمال العمانيين
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {initialProducts.length} منتج من تجّارنا المعتمدين
            </p>
          </div>
          <Link
            href="/store/cart"
            className="relative inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
          >
            <ShoppingCart className="h-4 w-4" />
            السلة
            {totals.unitCount > 0 && (
              <span className="absolute -top-2 -left-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A84C] px-1 text-[11px] font-bold text-[#1B3A6B]">
                {totals.unitCount}
              </span>
            )}
          </Link>
        </div>

        {/* Quick links strip */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href="/store/wishlist"
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-200 hover:text-red-600"
          >
            <Heart className={`h-3.5 w-3.5 ${favCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
            المفضلة
            {favCount > 0 && (
              <span className="ms-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            href="/store/vendor"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
          >
            <StoreIcon className="h-3.5 w-3.5" /> البائعون
          </Link>
        </div>

        {/* Search + Sort */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <form onSubmit={onSearch} className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder="ابحث عن منتج..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none"
          >
            <option value="newest">الأحدث</option>
            <option value="popular">الأكثر مبيعاً</option>
            <option value="price_asc">السعر: منخفض → مرتفع</option>
            <option value="price_desc">السعر: مرتفع → منخفض</option>
          </select>
        </div>

        {/* Categories */}
        <div className="mb-5 flex flex-wrap gap-2">
          <CategoryPill
            active={!category}
            onClick={() => setParam('category', '')}
            label="الكل"
            emoji="🛍️"
          />
          {PRODUCT_CATEGORIES.map((c) => (
            <CategoryPill
              key={c.key}
              active={category === c.key}
              onClick={() => setParam('category', c.key)}
              label={c.label}
              emoji={c.emoji}
            />
          ))}
        </div>

        {/* Grid */}
        {initialProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-gray-400" />
            <h3 className="mt-3 text-lg font-bold text-gray-700">لا توجد منتجات مطابقة</h3>
            <p className="mt-1 text-sm text-gray-500">جرِّب تعديل البحث أو مسح الفلتر</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {initialProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryPill({ active, onClick, label, emoji }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'
      }`}
    >
      <span className="text-sm">{emoji}</span>
      {label}
    </button>
  )
}
