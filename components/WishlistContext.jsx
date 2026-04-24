'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const WishlistContext = createContext({
  ids: [],
  count: 0,
  loading: false,
  has: () => false,
  toggle: async () => ({ ok: false }),
  refresh: async () => {},
})

export function WishlistProvider({ children }) {
  const { data: session, status } = useSession()
  const [ids, setIds] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!session?.user) { setIds([]); return }
    setLoading(true)
    try {
      const r = await fetch('/api/wishlist')
      if (!r.ok) { setIds([]); return }
      const d = await r.json()
      setIds((d.items || []).map((x) => x.id))
    } catch (e) {
      setIds([])
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (status === 'loading') return
    refresh()
  }, [status, refresh])

  const has = useCallback((productId) => ids.includes(productId), [ids])

  const toggle = useCallback(async (productId) => {
    if (!session?.user) {
      return { ok: false, needLogin: true }
    }
    const isIn = ids.includes(productId)
    // Optimistic update
    setIds((prev) => (isIn ? prev.filter((x) => x !== productId) : [productId, ...prev]))
    try {
      const res = await fetch(`/api/wishlist/${productId}`, {
        method: isIn ? 'DELETE' : 'POST',
      })
      if (!res.ok) {
        // revert on failure
        setIds((prev) => (isIn ? [productId, ...prev] : prev.filter((x) => x !== productId)))
        const d = await res.json().catch(() => ({}))
        return { ok: false, error: d?.error || 'حدث خطأ' }
      }
      return { ok: true, added: !isIn }
    } catch (e) {
      setIds((prev) => (isIn ? [productId, ...prev] : prev.filter((x) => x !== productId)))
      return { ok: false, error: 'تعذّر الاتصال' }
    }
  }, [ids, session?.user?.id])

  const value = { ids, count: ids.length, loading, has, toggle, refresh }
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  return useContext(WishlistContext)
}
