'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

const CartCtx = createContext(null)

const STORAGE_KEY = 'majles_cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items, hydrated])

  const addItem = useCallback((product, quantity = 1) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1)
    setItems((list) => {
      const idx = list.findIndex((x) => x.productId === product.id)
      if (idx >= 0) {
        const next = [...list]
        next[idx] = {
          ...next[idx],
          quantity: Math.min(
            (next[idx].quantity || 1) + qty,
            product.stock ?? 999
          ),
        }
        return next
      }
      return [
        ...list,
        {
          productId: product.id,
          nameAr: product.nameAr,
          image: (product.images && product.images[0]) || '',
          unitPrice: product.price,
          vendorName: product.vendorName || '',
          stock: product.stock || 0,
          quantity: Math.min(qty, product.stock ?? 999),
        },
      ]
    })
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1)
    setItems((list) =>
      list.map((x) =>
        x.productId === productId
          ? { ...x, quantity: Math.min(qty, x.stock ?? 999) }
          : x
      )
    )
  }, [])

  const removeItem = useCallback((productId) => {
    setItems((list) => list.filter((x) => x.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

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
