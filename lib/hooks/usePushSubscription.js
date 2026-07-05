'use client'

import { useCallback, useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

/**
 * usePushSubscription — client-side hook to manage Web Push subscription.
 *
 * Returns:
 *   supported   -> boolean
 *   permission  -> 'default' | 'granted' | 'denied' | 'unsupported'
 *   subscribed  -> boolean (true if there is an active subscription for this browser)
 *   busy        -> boolean (during subscribe/unsubscribe)
 *   error       -> string | null
 *   subscribe(lang) -> Promise<boolean>
 *   unsubscribe()   -> Promise<boolean>
 */
export default function usePushSubscription() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (!ok) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission || 'default')

    // Check current subscription state
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      } catch (e) {
        /* ignore */
      }
    })()
  }, [])

  const subscribe = useCallback(async (lang = 'ar') => {
    if (!supported) return false
    setError(null)
    setBusy(true)
    try {
      // Ensure permission
      let perm = Notification.permission
      if (perm === 'default') perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'denied' : 'default')
        return false
      }

      // Get SW registration (next-pwa registers /sw.js automatically)
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js')
      }
      await navigator.serviceWorker.ready

      // Fetch public VAPID key
      const res = await fetch('/api/push/public-key')
      const { publicKey } = await res.json()
      if (!publicKey) throw new Error('Missing VAPID public key')

      // Subscribe
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      // Send to backend
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON(), lang }),
      })
      if (!saveRes.ok) throw new Error('Server rejected subscription')

      setSubscribed(true)
      return true
    } catch (e) {
      console.error('[usePushSubscription.subscribe]', e)
      setError(e.message || 'generic')
      return false
    } finally {
      setBusy(false)
    }
  }, [supported])

  const unsubscribe = useCallback(async () => {
    if (!supported) return false
    setError(null)
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return false
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        setSubscribed(false)
        return true
      }
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint }),
        })
      } catch { /* ignore */ }
      setSubscribed(false)
      return true
    } catch (e) {
      console.error('[usePushSubscription.unsubscribe]', e)
      setError(e.message || 'generic')
      return false
    } finally {
      setBusy(false)
    }
  }, [supported])

  return { supported, permission, subscribed, busy, error, subscribe, unsubscribe }
}
