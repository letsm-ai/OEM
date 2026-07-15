'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

const CartCtx = createContext(null)

const STORAGE_KEY = 'majles_cart_v1'

/**
 * Dispatch a global `cart:updated` event that the CartWidget (or any other
 * subscriber) listens to for live badge/toast updates.
 * @param {{delta?:number, name?:string, total?:number}} detail
 */
function emitCartUpdated(detail = {}) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('cart:updated', { detail }))
  } catch (e) { /* older browsers */ }
}

export function CartProvider({ children }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const initialSyncDone = useRef(false)
  const syncTimeout = useRef(null)
  // Prevents accidental rapid double-clicks (mobile touch / React double-render)
  // from adding the same item twice within the same short window.
  const lastAddRef = useRef({ key: '', at: 0 })

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch (e) { /* corrupt storage → start empty */ }
    setHydrated(true)
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) { /* quota exceeded → skip */ }
  }, [items, hydrated])

  // On login: merge server cart with local (server-saved cart wins if local empty)
  useEffect(() => {
    if (!hydrated || status === 'loading') return
    if (!session?.user) {
      initialSyncDone.current = false
      return
    }
    if (initialSyncDone.current) return
    initialSyncDone.current = true
    ;(async () => {
      try {
        const r = await fetch('/api/cart')
        const d = await r.json()
        const serverItems = d?.items || []
        if (serverItems.length > 0 && items.length === 0) {
          // Restore server cart
          setItems(serverItems.map((it) => ({
            productId: it.productId,
            nameAr: it.nameAr,
            image: it.image || '',
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            variantId: it.variantId || '',
            variantName: it.variantName || '',
            stock: 999, // will be re-validated at checkout
          })))
        } else if (items.length > 0) {
          // Upload local cart to server
          syncToServer(items)
        }
      } catch (e) { /* noop */ }
    })()
  }, [session?.user?.id, hydrated, status])

  // Debounced sync on cart changes (only when logged in)
  const syncToServer = useCallback(async (list) => {
    if (!session?.user) return
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: list.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            nameAr: it.nameAr,
            unitPrice: it.unitPrice,
            image: it.image || '',
            variantId: it.variantId || '',
            variantName: it.variantName || '',
          })),
        }),
      })
    } catch (e) { /* noop */ }
  }, [session?.user?.id])

  useEffect(() => {
    if (!hydrated) return
    if (!session?.user) return
    if (!initialSyncDone.current) return
    // Debounce 2 seconds
    clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => syncToServer(items), 2000)
    return () => clearTimeout(syncTimeout.current)
  }, [items, hydrated, session?.user?.id, syncToServer])

  const addItem = useCallback((product, quantity = 1, variant = null) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1)
    const variantId = variant?.id || ''
    const variantName = variant?.name || ''
    const effectivePrice = variant && variant.price > 0 ? variant.price : product.price
    const effectiveStock = variant ? (variant.stock ?? 0) : (product.stock ?? 0)
    const effectiveImage = variant?.image || (product.images && product.images[0]) || ''

    // ---- Double-click / React double-render guard ----
    // If the SAME product+variant+qty is added twice within 400ms, ignore the
    // second call. This eliminates the "clicked once, added twice" bug caused
    // by mobile touch events or React strict-mode double-render in dev.
    const key = `${product.id}::${variantId}::${qty}`
    const now = Date.now()
    if (lastAddRef.current.key === key && (now - lastAddRef.current.at) < 400) {
      return
    }
    lastAddRef.current = { key, at: now }

    let broadcastTotal = 0
    setItems((list) => {
      const idx = list.findIndex(
        (x) => x.productId === product.id && (x.variantId || '') === variantId
      )
      let next
      if (idx >= 0) {
        next = [...list]
        next[idx] = {
          ...next[idx],
          quantity: Math.min(
            (next[idx].quantity || 1) + qty,
            effectiveStock || 999
          ),
        }
      } else {
        next = [
          ...list,
          {
            productId: product.id,
            nameAr: product.nameAr,
            image: effectiveImage,
            unitPrice: effectivePrice,
            vendorName: product.vendorName || '',
            stock: effectiveStock || 0,
            quantity: Math.min(qty, effectiveStock || 999),
            variantId,
            variantName,
          },
        ]
      }
      broadcastTotal = next.reduce((s, it) => s + Number(it.quantity || 0), 0)
      return next
    })
    // Broadcast so the nav badge + toast update immediately.
    emitCartUpdated({ delta: qty, name: product.nameAr, total: broadcastTotal })
  }, [])

  const updateQuantity = useCallback((productId, quantity, variantId = '') => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1)
    let broadcastTotal = 0
    setItems((list) => {
      const next = list.map((x) =>
        x.productId === productId && (x.variantId || '') === (variantId || '')
          ? { ...x, quantity: Math.min(qty, x.stock ?? 999) }
          : x
      )
      broadcastTotal = next.reduce((s, it) => s + Number(it.quantity || 0), 0)
      return next
    })
    emitCartUpdated({ total: broadcastTotal })
  }, [])

  const removeItem = useCallback((productId, variantId = '') => {
    let broadcastTotal = 0
    setItems((list) => {
      const next = list.filter(
        (x) => !(x.productId === productId && (x.variantId || '') === (variantId || ''))
      )
      broadcastTotal = next.reduce((s, it) => s + Number(it.quantity || 0), 0)
      return next
    })
    emitCartUpdated({ total: broadcastTotal })
  }, [])

  const clear = useCallback(() => {
    setItems([])
    // Also clear on server
    if (session?.user) {
      fetch('/api/cart', { method: 'DELETE' }).catch(() => {})
    }
    emitCartUpdated({ total: 0 })
  }, [session?.user?.id])

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + Number(it.unitPrice || 0) * Number(it.quantity || 0),
      0
    )
    const count = items.reduce((s, it) => s + Number(it.quantity || 0), 0)
    return {
      subtotal: +subtotal.toFixed(3),
      itemCount: items.length,
      unitCount: count,
    }
  }, [items])

  const value = useMemo(
    () => ({ items, addItem, updateQuantity, removeItem, clear, totals, hydrated }),
    [items, addItem, updateQuantity, removeItem, clear, totals, hydrated]
  )

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}

export function useCart() {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
