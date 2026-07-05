/**
 * Push subscription API handlers.
 * Public routes:
 *   GET  /api/push/public-key       -> { publicKey }
 *   POST /api/push/subscribe        -> save subscription
 *   POST /api/push/unsubscribe      -> mark disabled
 * Admin route (called separately from admin.js):
 *   POST /api/admin/push/broadcast  -> send to all
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { PushSubscription } from '@/lib/models'
import { sendPush, getActiveSubscriptions } from '@/lib/webpush'

const jsonError = (msg, code = 400) => NextResponse.json({ error: msg }, { status: code })

export async function handlePushPublicKey() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  return NextResponse.json({ publicKey: key })
}

export async function handlePushSubscribe(request) {
  try {
    const body = await request.json()
    const sub = body?.subscription
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return jsonError('Invalid subscription payload')
    }
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    const lang = body?.lang === 'en' ? 'en' : 'ar'
    const userAgent = String(request.headers.get('user-agent') || '').slice(0, 300)

    await connectDB()
    // Upsert by endpoint
    const updated = await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        $set: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userId,
          lang,
          userAgent,
          disabled: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()

    return NextResponse.json({ ok: true, id: updated._id })
  } catch (err) {
    console.error('[push.subscribe]', err)
    return jsonError('Could not save subscription', 500)
  }
}

export async function handlePushUnsubscribe(request) {
  try {
    const body = await request.json()
    const endpoint = body?.endpoint
    if (!endpoint) return jsonError('endpoint required')
    await connectDB()
    await PushSubscription.updateOne({ endpoint }, { $set: { disabled: true } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push.unsubscribe]', err)
    return jsonError('Could not unsubscribe', 500)
  }
}

/**
 * Admin broadcast — requires admin session.
 * Body: { title, body, url?, image?, tag?, lang? }
 *       lang optional: 'ar' | 'en' | 'all' (default 'all')
 */
export async function handlePushBroadcast(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return jsonError('Admin only', 403)
    }
    const body = await request.json()
    const { title, body: msg, url, image, tag, lang } = body || {}
    if (!title || !msg) return jsonError('title and body required')

    const filter = {}
    if (lang === 'ar' || lang === 'en') filter.lang = lang

    const subs = await getActiveSubscriptions(filter)
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, disabled: 0, targeted: 0 })
    }

    const payload = {
      title,
      body: msg,
      url: url || '/',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      image: image || undefined,
      tag: tag || 'majles-broadcast',
      dir: lang === 'en' ? 'ltr' : 'rtl',
      lang: lang === 'en' ? 'en' : 'ar',
      renotify: true,
    }

    const result = await sendPush(subs, payload)
    return NextResponse.json({ ok: true, targeted: subs.length, ...result })
  } catch (err) {
    console.error('[push.broadcast]', err)
    return jsonError('Broadcast failed', 500)
  }
}

/** Admin: count of active subscribers */
export async function handlePushStats() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return jsonError('Admin only', 403)
    }
    await connectDB()
    const [total, active, ar, en, authed] = await Promise.all([
      PushSubscription.countDocuments({}),
      PushSubscription.countDocuments({ disabled: { $ne: true } }),
      PushSubscription.countDocuments({ disabled: { $ne: true }, lang: 'ar' }),
      PushSubscription.countDocuments({ disabled: { $ne: true }, lang: 'en' }),
      PushSubscription.countDocuments({ disabled: { $ne: true }, userId: { $ne: null } }),
    ])
    return NextResponse.json({ total, active, ar, en, authed, guests: active - authed })
  } catch (err) {
    return jsonError('Stats failed', 500)
  }
}
