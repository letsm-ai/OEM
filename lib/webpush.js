/**
 * Web Push helper.
 * Configured once with VAPID keys from env vars.
 * `send()` supports single subscription or an array; automatically
 * disables subscriptions the push service rejects with 404/410.
 */

import webpush from 'web-push'
import { connectDB } from '@/lib/db'
import { PushSubscription } from '@/lib/models'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@omanimajles.com'

let configured = false
export function configureWebPush() {
  if (configured) return
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error('VAPID keys missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env')
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  configured = true
}

/**
 * Send a push notification.
 * @param {object|object[]} subs   Single subscription (or `_id`) or array of them
 * @param {object} payload         { title, body, url, icon, image, tag, actions, data }
 * @returns {Promise<{ sent: number, failed: number, disabled: number }>}
 */
export async function sendPush(subs, payload) {
  configureWebPush()
  await connectDB()

  const list = Array.isArray(subs) ? subs : [subs]
  if (list.length === 0) return { sent: 0, failed: 0, disabled: 0 }

  const encoded = JSON.stringify(payload)

  let sent = 0
  let failed = 0
  let disabled = 0

  await Promise.all(
    list.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
      }
      try {
        await webpush.sendNotification(subscription, encoded, { TTL: 60 * 60 * 24 })
        sent += 1
        // Best-effort — update last notified
        if (s._id) {
          await PushSubscription.updateOne(
            { _id: s._id },
            { $set: { lastNotifiedAt: new Date(), disabled: false } }
          )
        }
      } catch (err) {
        failed += 1
        const code = err.statusCode || err.status
        // Gone / not registered — mark subscription disabled
        if (code === 404 || code === 410) {
          disabled += 1
          if (s._id) {
            await PushSubscription.updateOne(
              { _id: s._id },
              { $set: { disabled: true } }
            )
          }
        }
      }
    })
  )

  return { sent, failed, disabled }
}

/** Return all active (non-disabled) subscriptions, optionally filtered by userId */
export async function getActiveSubscriptions(filter = {}) {
  await connectDB()
  return await PushSubscription.find({ disabled: { $ne: true }, ...filter }).lean()
}
