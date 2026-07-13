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
import {
  getEffectivePrice,
  isFreeModeActive,
  getSettings,
  subscriptionEndDate,
  daysFromNow,
  getTrialPolicy,
} from '@/lib/settings'
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

  // ---- Runtime pricing / free-mode (admin-controlled from /admin/settings) ----
  const effectivePrice = await getEffectivePrice(tier)
  const endDate = await subscriptionEndDate(now)
  const isFree = effectivePrice === 0
  const freeMode = await isFreeModeActive()

  // ---- FREE MODE: admin has toggled "everything free" for this tier — activate directly ----
  if (isFree && freeMode) {
    const membership = await Membership.create({
      userId: session.user.id,
      tier,
      startDate: now,
      endDate,
      amountPaid: 0,
      paymentStatus: 'PAID',
    })
    const user = await User.findByIdAndUpdate(
      session.user.id,
      { membershipTier: tier, membershipExpiry: endDate },
      { new: true }
    ).lean()

    sendSubscriptionEmail({
      to: user.email,
      name: user.name,
      tierAr: meta.nameAr,
      amount: 0,
      expiryFormatted: formatArabicDate(endDate),
    }).catch((e) => console.error('subscription email failed:', e))

    return json({
      success: true,
      freeMode: true,
      membership: {
        id: membership._id,
        tier,
        startDate: now,
        endDate,
        amountPaid: 0,
        paymentStatus: 'PAID',
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

  // ---- Thawani configuration guard (fail loud instead of silently activating free) ----
  if (!isThawaniEnabled()) {
    const missing = []
    if (!process.env.THAWANI_SECRET_KEY) missing.push('THAWANI_SECRET_KEY')
    if (!process.env.THAWANI_BASE_URL) missing.push('THAWANI_BASE_URL')
    if ((process.env.PAYMENT_PROVIDER || 'thawani').toLowerCase() === 'mock')
      missing.push('PAYMENT_PROVIDER=mock')
    console.error(
      `[membership] Thawani NOT configured — user=${session.user.id} tier=${tier} missing=[${missing.join(', ')}]`
    )
    return json(
      {
        error: 'بوابة الدفع غير مُفعّلة حالياً. يرجى التواصل مع الدعم.',
        code: 'THAWANI_NOT_CONFIGURED',
        missing,
      },
      { status: 503 }
    )
  }

  // Create PENDING membership row that will be finalized on payment success.
  const membership = await Membership.create({
    userId: session.user.id,
    tier,
    startDate: now,
    endDate,
    amountPaid: effectivePrice,
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
          unitAmountOmr: effectivePrice,
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
      console.error(
        '[membership] Thawani session create FAILED',
        JSON.stringify({
          status: cs.status,
          error: cs.error,
          responseData: cs.data,
          user: session.user.id,
          tier,
          amount: effectivePrice,
        })
      )
      return json(
        {
          error: cs.error || 'تعذّر الاتصال ببوابة الدفع',
          code: 'THAWANI_CREATE_SESSION_FAILED',
          providerStatus: cs.status,
        },
        { status: 502 }
      )
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

/**
 * POST /membership/start-trial
 * Body: { tier: 'BASIC' | 'GOLD' | 'PLATINUM' }
 * Activates a one-time free trial for the current user. The trial length and
 * whether a specific tier is enforced come from SiteSettings.trial.
 * A user can only ever start ONE trial (User.trialUsed).
 */
export async function handleMembershipStartTrial(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth

  const body = await request.json().catch(() => ({}))
  const requestedTier = String(body?.tier || '').toUpperCase()

  await connectDB()
  const policy = await getTrialPolicy()
  if (!policy.enabled) {
    return err('التجربة المجانية غير مُفعّلة حالياً', 400)
  }

  // If admin locked the trial to a specific tier, force it. Otherwise the
  // user picks any paid tier.
  const effectiveTier =
    policy.allowedTier && policy.allowedTier !== ''
      ? policy.allowedTier
      : requestedTier

  if (!['BASIC', 'GOLD', 'PLATINUM'].includes(effectiveTier)) {
    return err('باقة التجربة غير صحيحة', 400)
  }

  const user = await User.findById(session.user.id).lean()
  if (!user) return err('المستخدم غير موجود', 404)
  if (user.trialUsed) {
    return err('لقد استخدمت تجربتك المجانية مسبقاً', 400)
  }
  // Don't start a trial if the user already has an active paid tier
  if (
    user.membershipTier &&
    user.membershipTier !== 'FREE' &&
    user.membershipExpiry &&
    new Date(user.membershipExpiry) > new Date()
  ) {
    return err('لديك بالفعل باقة نشطة', 400)
  }

  const now = new Date()
  const trialEnd = daysFromNow(policy.durationDays, now)

  const updated = await User.findByIdAndUpdate(
    session.user.id,
    {
      $set: {
        membershipTier: effectiveTier,
        membershipExpiry: trialEnd,
        trialUsed: true,
        trialTier: effectiveTier,
        trialStart: now,
        trialEnd,
        trialReminderSent: false,
      },
    },
    { new: true }
  )
    .select('-password')
    .lean()

  // Log to the Membership history so the admin can see it
  await Membership.create({
    userId: session.user.id,
    tier: effectiveTier,
    startDate: now,
    endDate: trialEnd,
    amountPaid: 0,
    paymentStatus: 'PAID',
  })

  return json({
    success: true,
    trial: {
      tier: effectiveTier,
      start: now,
      end: trialEnd,
      durationDays: policy.durationDays,
    },
    user: {
      id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      membershipTier: updated.membershipTier,
      membershipExpiry: updated.membershipExpiry,
      trialUsed: updated.trialUsed,
      trialEnd: updated.trialEnd,
    },
  })
}

/** GET /membership/trial-status — public status for the current user */
export async function handleMembershipTrialStatus() {
  const session = await getServerSession(authOptions)
  await connectDB()
  const policy = await getTrialPolicy()
  if (!session?.user) {
    return json({
      loggedIn: false,
      enabled: policy.enabled,
      durationDays: policy.durationDays,
      allowedTier: policy.allowedTier,
    })
  }
  const user = await User.findById(session.user.id)
    .select('trialUsed trialTier trialStart trialEnd')
    .lean()
  return json({
    loggedIn: true,
    enabled: policy.enabled,
    durationDays: policy.durationDays,
    allowedTier: policy.allowedTier,
    trialUsed: !!user?.trialUsed,
    trialTier: user?.trialTier || '',
    trialStart: user?.trialStart || null,
    trialEnd: user?.trialEnd || null,
  })
}

