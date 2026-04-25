/**
 * Cart endpoints + abandoned cart cron.
 *   POST   /cart
 *   GET    /cart
 *   DELETE /cart
 *   POST   /cron/abandoned-carts (X-CRON-KEY header OR ADMIN session)
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Cart } from '@/lib/models'
import { sendAbandonedCartEmail } from '@/lib/email'
import { json, err, requireAuth } from './_helpers'

export async function handleCartUpsert(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const rawItems = Array.isArray(body?.items) ? body.items : []
  const items = rawItems
    .slice(0, 100)
    .map((it) => ({
      productId: String(it.productId || ''),
      quantity: Math.max(1, Math.min(99, parseInt(it.quantity || 1, 10))),
      nameAr: String(it.nameAr || '').slice(0, 100),
      unitPrice: Number(it.unitPrice || 0),
      image: String(it.image || '').slice(0, 2000),
    }))
    .filter((it) => it.productId)
  await Cart.findOneAndUpdate(
    { userId: session.user.id },
    {
      $set: {
        items,
        updatedAt: new Date(),
        lastReminderSentAt: null,
        reminderEmailsSent: 0,
      },
    },
    { upsert: true, new: true }
  )
  return json({ success: true, count: items.length })
}

export async function handleCartGet() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return json({ items: [] })
  await connectDB()
  const c = await Cart.findOne({ userId: session.user.id }).lean()
  return json({ items: c?.items || [] })
}

export async function handleCartClear() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return json({ success: true })
  await connectDB()
  await Cart.findOneAndUpdate(
    { userId: session.user.id },
    { $set: { items: [], updatedAt: new Date() } },
    { upsert: true }
  )
  return json({ success: true })
}

export async function handleAbandonedCartCron(request) {
  const cronKey = request.headers.get('x-cron-key') || ''
  const expectedKey = process.env.CRON_SECRET_KEY || ''
  let authorized = false
  if (expectedKey && cronKey === expectedKey) {
    authorized = true
  } else {
    const session = await getServerSession(authOptions)
    if (session?.user?.role === 'ADMIN') authorized = true
  }
  if (!authorized) return err('غير مصرح', 401)

  await connectDB()
  const now = Date.now()
  const minAge = new Date(now - 24 * 60 * 60 * 1000)
  const maxAge = new Date(now - 72 * 60 * 60 * 1000)
  const candidates = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: minAge, $gte: maxAge },
    reminderEmailsSent: { $lt: 1 },
  })
    .limit(100)
    .lean()

  let sent = 0
  for (const c of candidates) {
    try {
      const user = await User.findById(c.userId)
        .select({ _id: 1, name: 1, email: 1 })
        .lean()
      if (!user?.email) continue
      await sendAbandonedCartEmail({
        to: user.email,
        name: user.name,
        items: c.items,
      })
      await Cart.findOneAndUpdate(
        { _id: c._id },
        {
          $set: { lastReminderSentAt: new Date() },
          $inc: { reminderEmailsSent: 1 },
        }
      )
      sent++
    } catch (e) {
      console.error('[cron abandoned-cart] failed for', c._id, e)
    }
  }
  return json({ success: true, candidates: candidates.length, sent })
}
