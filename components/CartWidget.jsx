'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Check } from 'lucide-react'
import { useCart } from '@/components/CartContext'

/**
 * Cart widget for the top-nav.
 *
 * - Shows a shopping-cart icon with a live badge (from CartContext).
 * - Works for BOTH signed-in users (server-backed cart) and guests (localStorage
 *   only), so anonymous shoppers still see their basket count.
 * - Listens to `window` `cart:updated` events to trigger a "bump" animation
 *   and a floating "added to cart" toast whenever detail.delta > 0.
 */
export default function CartWidget({ className = '' }) {
  const { totals, hydrated } = useCart()
  const count = totals?.unitCount || 0

  const [flash, setFlash] = useState(null) // { name, delta }
  const [bump, setBump] = useState(false)
  const flashTimer = useRef(null)
  const bumpTimer = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail || {}
      // Pop animation on every mutation
      if (bumpTimer.current) clearTimeout(bumpTimer.current)
      setBump(true)
      bumpTimer.current = setTimeout(() => setBump(false), 450)
      // Toast only on additive events
      if (typeof d.delta === 'number' && d.delta > 0) {
        if (flashTimer.current) clearTimeout(flashTimer.current)
        setFlash({ name: d.name || '', delta: d.delta })
        flashTimer.current = setTimeout(() => setFlash(null), 3200)
      }
    }
    window.addEventListener('cart:updated', handler)
    return () => {
      window.removeEventListener('cart:updated', handler)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (bumpTimer.current) clearTimeout(bumpTimer.current)
    }
  }, [])

  // Avoid an SSR-mismatch flicker: only render badge count after hydration.
  const showBadge = hydrated && count > 0

  return (
    <>
      <Link
        href="/store/cart"
        aria-label={`السلة (${count} عنصر)`}
        title="سلة المشتريات"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F8F9FA] text-[#1B3A6B] transition hover:bg-[#eef1f5] ${className}`}
      >
        <ShoppingCart className="h-5 w-5" />
        {showBadge && (
          <span
            className={`absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A84C] px-1 text-[10px] font-bold text-[#1B3A6B] shadow ${
              bump ? 'animate-cart-bump' : ''
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>

      {/* Floating "added to cart" toast */}
      {flash && (
        <div
          className="pointer-events-none fixed left-4 right-4 top-[76px] z-[100] flex justify-center sm:right-6 sm:left-auto sm:top-[80px] sm:justify-end"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-right">
              <div className="text-sm font-bold text-[#1B3A6B]">
                تمت الإضافة إلى السلة
              </div>
              {flash.name && (
                <div className="mt-0.5 truncate text-xs text-gray-500">
                  {flash.name}
                </div>
              )}
            </div>
            <Link
              href="/store/cart"
              className="ms-1 shrink-0 rounded-md bg-[#1B3A6B] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#152c52]"
            >
              عرض السلة
            </Link>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes cart-bump {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          70% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .animate-cart-bump { animation: cart-bump 0.45s ease-out; }
      `}</style>
    </>
  )
}
