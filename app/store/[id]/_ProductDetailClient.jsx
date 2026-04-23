'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Minus, Plus, ChevronRight, CheckCircle2, Package, Tag, Store as StoreIcon, ArrowLeft } from 'lucide-react'
import { formatOMR, categoryEmoji, categoryLabel } from '@/lib/store'
import { useCart } from '@/components/CartContext'

export default function ProductDetailClient({ product }) {
  const router = useRouter()
  const { addItem } = useCart()
  const [qty, setQty] = useState(1)
  const [selImg, setSelImg] = useState(0)
  const [added, setAdded] = useState(false)
  const outOfStock = (product.stock || 0) <= 0

  const imgs = product.images && product.images.length > 0 ? product.images : []

  const handleAdd = () => {
    addItem(product, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }
  const buyNow = () => {
    addItem(product, qty)
    router.push('/store/cart')
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-6xl px-4">
        <nav className="mb-4 flex items-center gap-1 text-xs text-gray-500">
          <Link href="/store" className="hover:text-[#1B3A6B]">المتجر</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-700">{product.nameAr}</span>
        </nav>

        <div className="grid gap-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr]">
          {/* Gallery */}
          <div>
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-bl from-[#F8F9FA] to-white">
              {imgs[selImg] ? (
                <img src={imgs[selImg]} alt={product.nameAr} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-8xl opacity-70">
                  {categoryEmoji(product.category)}
                </div>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {imgs.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelImg(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 ${
                      i === selImg ? 'border-[#1B3A6B]' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-1 self-start rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-semibold text-[#1B3A6B]">
              {categoryEmoji(product.category)} {categoryLabel(product.category)}
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
              {product.nameAr}
            </h1>
            {product.nameEn && (
              <div dir="ltr" className="mt-1 text-right text-sm text-gray-400">
                {product.nameEn}
              </div>
            )}

            <div className="mt-2 inline-flex items-center gap-1 self-start text-xs text-gray-500">
              <StoreIcon className="h-3.5 w-3.5" />
              بواسطة: <span className="font-semibold text-gray-700">{product.vendorName}</span>
            </div>

            <div className="mt-4 rounded-xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-4 text-white">
              <div className="text-3xl font-extrabold">
                {formatOMR(product.price)}
                <span className="ms-2 text-sm font-medium opacity-80">ريال عماني</span>
              </div>
              <div className="mt-1 text-[11px] opacity-80">خصم العضوية يُطبّق عند إتمام الطلب</div>
            </div>

            {product.description && (
              <div className="mt-4">
                <h2 className="mb-1.5 text-sm font-bold text-[#1B3A6B]">الوصف</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {product.description}
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-gray-500" />
              {outOfStock ? (
                <span className="font-semibold text-red-600">نفد المخزون</span>
              ) : (
                <span className="text-gray-700">متوفر: <b>{product.stock}</b> قطعة</span>
              )}
            </div>

            {!outOfStock && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="w-16 rounded-lg border border-gray-300 bg-white py-2 text-center font-bold">
                  {qty}
                </div>
                <button
                  onClick={() => setQty((n) => Math.min(product.stock || 99, n + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleAdd}
                disabled={outOfStock}
                className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  added
                    ? 'bg-green-600 text-white'
                    : 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
                }`}
              >
                {added ? (
                  <><CheckCircle2 className="h-4 w-4" /> تمت الإضافة</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> أضف إلى السلة</>
                )}
              </button>
              <button
                onClick={buyNow}
                disabled={outOfStock}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B3A6B] py-3 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
              >
                اشترِ الآن
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
