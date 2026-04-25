/**
 * Membership endpoints.
 *   POST /membership/subscribe  — upgrade tier (mock or Thawani)
 *   GET  /membership/history    — current user's subscription log
 *   POST /membership/discount   — preview tier discount on a price
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Membership } from '@/lib/models'
import {
  TIERS,
  TIER_META,
  oneYearFromNow,
  applyDiscount,
  formatArabicDate,
} from '@/lib/membership'
import { sendSubscriptionEmail } from '@/lib/email'
import { json, err, requireAuth } from './_helpers'

export async function handleMembershipSubscribe(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth

  const body = await request.json().catch(() => ({}))
  const { tier } = body || {}

  if (!tier || !TIERS.includes(tier)) return err('باقة غير صحيحة', 400)
  if (tier === 'FREE') return err('الباقة المجانية مفعلة تلقائياً', 400)

  await connectDB()
  const meta = TIER_META[tier]
  const now = new Date()
  const endDate = oneYearFromNow(now)

  const user = await User.findByIdAndUpdate(
    session.user.id,
    { membershipTier: tier, membershipExpiry: endDate },
    { new: true }
  ).lean()

  if (!user) return err('المستخدم غير موجود', 404)

  const membership = await Membership.create({
    userId: user._id,
    tier,
    startDate: now,
    endDate,
    amountPaid: meta.price,
    paymentStatus: 'PAID',
  })

  sendSubscriptionEmail({
    to: user.email,
    name: user.name,
    tierAr: meta.nameAr,
    amount: meta.price,
    expiryFormatted: formatArabicDate(endDate),
  }).catch((e) => console.error('subscription email failed:', e))

  return json({
    success: true,
    membership: {
      id: membership._id,
      tier: membership.tier,
      startDate: membership.startDate,
      endDate: membership.endDate,
      amountPaid: membership.amountPaid,
      paymentStatus: membership.paymentStatus,
    },
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipTier: user.membershipTier,
      membershipExpiry: user.membershipExpiry,
    },
  })
}

export async function handleMembershipHistory() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const list = await Membership.find({ userId: session.user.id })
    .sort({ startDate: -1 })
    .lean()
  return json({
    history: list.map((m) => ({
      id: m._id,
      tier: m.tier,
      startDate: m.startDate,
      endDate: m.endDate,
      amountPaid: m.amountPaid,
      paymentStatus: m.paymentStatus,
    })),
  })
}

export async function handleMembershipDiscount(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json().catch(() => ({}))
  const { price } = body || {}
  if (typeof price !== 'number' || price < 0) return err('السعر غير صحيح', 400)

  let tier = 'FREE'
  if (session?.user?.id) {
    await connectDB()
    const user = await User.findById(session.user.id).lean()
    tier = user?.membershipTier || 'FREE'
  }
  const result = applyDiscount(price, tier)
  return json({ tier, ...result })
}
