/**
 * Membership endpoints.
 *   POST /membership/subscribe  — creates a Thawani checkout session (LIVE — no mock fallback)
 *   POST /membership/verify     — verifies a Thawani session_id and activates tier
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
import {
  isThawaniEnabled,
  createCheckoutSession,
  getCheckoutSession,
} from '@/lib/payments/thawani'
import { json, err, requireAuth } from './_helpers'

/**
 * POST /membership/subscribe
 * Body: { tier: 'BASIC' | 'GOLD' | 'PLATINUM' }
 * Response (LIVE Thawani — the only path):
 *   { requiresPayment: true, redirectUrl, sessionId, membershipId }
 * If Thawani is misconfigured, returns 503 to avoid silently activating a free tier.
 */
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

  // ---- Thawani configuration guard (fail loud instead of silently activating free) ----
  if (!isThawaniEnabled()) {
    console.error(
      '[membership] Thawani is not configured (missing THAWANI_SECRET_KEY / THAWANI_BASE_URL / or PAYMENT_PROVIDER=mock). Refusing to activate a paid tier without payment.'
    )
    return err('بوابة الدفع غير مُفعّلة حالياً. الرجاء المحاولة لاحقاً.', 503)
  }

  // Create PENDING membership row that will be finalized on payment success.
  const membership = await Membership.create({
    userId: session.user.id,
    tier,
    startDate: now,
    endDate,
    amountPaid: meta.price,
    paymentStatus: 'PENDING',
  })

  // ---- Thawani (LIVE) ----
  {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.APP_URL ||
      'https://omanimajles.com'
    const cs = await createCheckoutSession({
      clientReferenceId: `mem_${membership._id}`,
      products: [
        {
          name: `عضوية ${meta.nameAr} — مجلس رواد الأعمال`,
          quantity: 1,
          unitAmountOmr: meta.price,
        },
      ],
      successUrl: `${base}/membership/success?session_id={CHECKOUT_SESSION_ID}&mid=${membership._id}`,
      cancelUrl: `${base}/membership/cancel?mid=${membership._id}`,
      metadata: {
        kind: 'membership',
        membership_id: String(membership._id),
        user_id: String(session.user.id),
        tier,
      },
    })

    if (!cs.ok) {
      // Roll back the PENDING row so the user can retry cleanly
      await Membership.deleteOne({ _id: membership._id }).catch(() => {})
      console.error('[membership] Thawani session create failed:', cs.status, cs.data)
      return err(cs.error || 'تعذّر الاتصال ببوابة الدفع', 502)
    }

    // Save session id on the membership for later reconciliation
    await Membership.updateOne(
      { _id: membership._id },
      { $set: { thawaniSessionId: cs.sessionId, thawaniInvoice: cs.invoice || '' } }
    )

    return json({
      requiresPayment: true,
      membershipId: membership._id,
      sessionId: cs.sessionId,
      redirectUrl: cs.redirectUrl,
    })
  }
}

/**
 * POST /membership/verify
 * Body: { sessionId?, membershipId? }
 * Verifies with Thawani that the checkout has been paid, then activates the tier.
 * Idempotent — safe to call from the success page multiple times.
 */
export async function handleMembershipVerify(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth

  const body = await request.json().catch(() => ({}))
  const { sessionId, membershipId } = body || {}
  if (!sessionId && !membershipId) return err('sessionId أو membershipId مطلوب', 400)

  await connectDB()
  const mem = await Membership.findOne(
    membershipId
      ? { _id: membershipId, userId: session.user.id }
      : { thawaniSessionId: sessionId, userId: session.user.id }
  )
  if (!mem) return err('طلب العضوية غير موجود', 404)

  // Already paid? Just return current state.
  if (mem.paymentStatus === 'PAID') {
    const u = await User.findById(mem.userId).lean()
    return json({
      success: true,
      alreadyPaid: true,
      membership: {
        id: mem._id,
        tier: mem.tier,
        paymentStatus: mem.paymentStatus,
        endDate: mem.endDate,
      },
      user: u
        ? {
            id: u._id,
            membershipTier: u.membershipTier,
            membershipExpiry: u.membershipExpiry,
          }
        : null,
    })
  }

  if (!isThawaniEnabled()) return err('بوابة الدفع غير مُفعّلة', 500)

  const sid = mem.thawaniSessionId || sessionId
  if (!sid) return err('جلسة الدفع غير موجودة', 400)

  const r = await getCheckoutSession(sid)
  if (!r.ok) return err('تعذّر التحقّق من جلسة الدفع', 502)

  if (r.paymentStatus !== 'paid') {
    return json({
      success: false,
      paymentStatus: r.paymentStatus,
      message:
        r.paymentStatus === 'unpaid'
          ? 'لم يكتمل الدفع بعد'
          : 'تم إلغاء الدفع',
    })
  }

  // Activate the tier
  const meta = TIER_META[mem.tier]
  const user = await User.findByIdAndUpdate(
    mem.userId,
    { membershipTier: mem.tier, membershipExpiry: mem.endDate },
    { new: true }
  ).lean()

  mem.paymentStatus = 'PAID'
  await mem.save()

  sendSubscriptionEmail({
    to: user.email,
    name: user.name,
    tierAr: meta.nameAr,
    amount: meta.price,
    expiryFormatted: formatArabicDate(mem.endDate),
  }).catch((e) => console.error('subscription email failed:', e))

  return json({
    success: true,
    membership: {
      id: mem._id,
      tier: mem.tier,
      paymentStatus: 'PAID',
      endDate: mem.endDate,
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
