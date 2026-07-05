// This file is auto-appended by next-pwa to the generated /public/sw.js.
// It handles Web Push notifications (push + notificationclick events).
// See: https://developer.mozilla.org/docs/Web/API/Push_API

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch (e) {
    // Not JSON — fall back to plain text
    payload = { title: 'مجلس رواد الأعمال', body: event.data.text() }
  }

  const title = payload.title || 'مجلس رواد الأعمال العماني'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-96x96.png',
    image: payload.image || undefined,
    dir: payload.dir || 'auto',
    lang: payload.lang || 'ar',
    tag: payload.tag || 'majles-notification',
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    // Action buttons (optional). Provide array like [{ action: 'open', title: '...' }]
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Focus an existing tab if it already has the site open
      for (const client of allClients) {
        try {
          const u = new URL(client.url)
          if (u.origin === self.location.origin) {
            await client.focus()
            if ('navigate' in client) {
              await client.navigate(targetUrl)
            }
            return
          }
        } catch (e) {
          /* ignore */
        }
      }

      // Otherwise open a new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })()
  )
})

// Optional: refresh subscription automatically if the browser rotates it.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSub.toJSON() }),
          credentials: 'include',
        })
      } catch (e) {
        // swallow — user may need to re-enable manually
      }
    })()
  )
})
