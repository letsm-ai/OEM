'use client'

import { SessionProvider } from 'next-auth/react'
import { CartProvider } from './CartContext'
import { WishlistProvider } from './WishlistContext'

export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      <WishlistProvider>
        <CartProvider>{children}</CartProvider>
      </WishlistProvider>
    </SessionProvider>
  )
}
