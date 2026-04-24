'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Loader2, ShoppingCart, Trash2, Package } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { useWishlist } from '@/components/WishlistContext'

export default function WishlistClient() {
  const { refresh } = useWishlist()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/wishlist')
      const d = await r.json()
      setItems(d.items || [])
    } catch (e) {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Keep in sync with context when user toggles fav from within this page
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#1B3A6B]">المفضلة</h1>
              <p className="text-sm text-gray-500">
                {loading ? '...' : `${items.length} منتج في قائمتك`}
              </p>
            </div>
          </div>
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152c52]"
          >
            <ShoppingCart className="h-4 w-4" />
            متابعة التسوق
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Heart className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <div className="mb-1 text-lg font-bold text-gray-700">قائمة المفضلة فارغة</div>
            <p className="mb-5 text-sm text-gray-500">
              تصفّح المتجر وأضف المنتجات التي تعجبك بالضغط على أيقونة القلب ❤️
            </p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#1B3A6B] hover:bg-[#b89440]"
            >
              <Package className="h-4 w-4" />
              ابدأ التسوق
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
