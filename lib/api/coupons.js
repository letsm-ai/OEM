/**
 * Discount Coupon endpoints.
 *   POST  /coupons/validate
 *   GET   /admin/coupons
 *   POST  /admin/coupons
 *   PATCH /admin/coupons/:id
 *   DELETE /admin/coupons/:id
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Coupon, CouponRedemption } from '@/lib/models'
import { TIER_DISCOUNT_PERCENT } from '@/lib/store'
import { json, err, requireAuth, requireRole } from './_helpers'

/**
 * Core validation — shared with order creation.
 * Returns {ok, coupon, discountAmount} or {ok:false, error}.
 */
export async function validateCouponForUser(rawCode, userId, baseAmount) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) return { ok: false, error: 'رمز الكوبون مطلوب' }
  const coupon = await Coupon.findOne({ code })
  if (!coupon) return { ok: false, error: 'رمز الكوبون غير صحيح' }
  if (!coupon.active) return { ok: false, error: 'الكوبون غير فعّال' }
  const now = new Date()
  if (coupon.startsAt && now < coupon.startsAt)
    return { ok: false, error: 'الكوبون غير فعّال بعد' }
  if (coupon.expiresAt && now > coupon.expiresAt)
    return { ok: false, error: 'انتهت صلاحية الكوبون' }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, error: 'تم استنفاد هذا الكوبون' }
  if (coupon.minSubtotal > 0 && baseAmount < coupon.minSubtotal)
    return {
      ok: false,
      error: `الحد الأدنى لاستخدام الكوبون: ${coupon.minSubtotal} ر.ع`,
    }
  if (userId && coupon.perUserLimit > 0) {
    const used = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
    })
    if (used >= coupon.perUserLimit)
      return {
        ok: false,
        error: 'لقد استخدمت هذا الكوبون لأقصى عدد مسموح به',
      }
  }
  let discountAmount = 0
  if (coupon.type === 'PERCENT') {
    discountAmount = +(baseAmount * (coupon.value / 100)).toFixed(3)
    if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount)
      discountAmount = coupon.maxDiscount
  } else {
    discountAmount = Math.min(coupon.value, baseAmount)
  }
  discountAmount = Math.max(0, +discountAmount.toFixed(3))
  return { ok: true, coupon, discountAmount }
}

export async function handleCouponValidate(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return err('يجب تسجيل الدخول', 401)
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const rawCode = body?.code
  const subtotal = Number(body?.subtotal || 0)
  if (!rawCode || subtotal <= 0) return err('السلة فارغة', 400)
  const buyer = await User.findById(session.user.id)
    .select({ membershipTier: 1 })
    .lean()
  const tier = buyer?.membershipTier || 'FREE'
  const tierPct = TIER_DISCOUNT_PERCENT[tier] || 0
  const tierDiscount = +(subtotal * (tierPct / 100)).toFixed(3)
  const baseAmount = +(subtotal - tierDiscount).toFixed(3)
  const r = await validateCouponForUser(rawCode, session.user.id, baseAmount)
  if (!r.ok) return json({ valid: false, error: r.error })
  const finalTotal = Math.max(0, +(baseAmount - r.discountAmount).toFixed(3))
  return json({
    valid: true,
    code: r.coupon.code,
    type: r.coupon.type,
    value: r.coupon.value,
    description: r.coupon.description || '',
    tierDiscountPercent: tierPct,
    tierDiscountAmount: tierDiscount,
    baseAmount,
    couponDiscountAmount: r.discountAmount,
    finalTotal,
  })
}

export async function handleAdminCouponsList() {
  const session = await getServerSession(authOptions)
  const denied = requireRole(session, ['ADMIN'])
  if (denied) return denied
  await connectDB()
  const list = await Coupon.find({}).sort({ createdAt: -1 }).lean()
  return json({
    coupons: list.map((c) => ({
      id: c._id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minSubtotal: c.minSubtotal,
      maxDiscount: c.maxDiscount,
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      perUserLimit: c.perUserLimit,
      active: c.active,
      createdAt: c.createdAt,
    })),
  })
}

export async function handleAdminCouponCreate(request) {
  const session = await getServerSession(authOptions)
  const denied = requireRole(session, ['ADMIN'])
  if (denied) return denied
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const code = String(body?.code || '').trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,32}$/.test(code))
    return err('الرمز يجب أن يكون بين 3 و 32 من الأحرف والأرقام', 400)
  const type = body?.type === 'FIXED' ? 'FIXED' : 'PERCENT'
  const value = Number(body?.value)
  if (!(value > 0)) return err('قيمة الخصم غير صحيحة', 400)
  if (type === 'PERCENT' && value > 100)
    return err('نسبة الخصم يجب ألا تتجاوز 100%', 400)
  const existing = await Coupon.findOne({ code }).lean()
  if (existing) return err('رمز الكوبون مستخدم مسبقاً', 409)
  const coupon = await Coupon.create({
    code,
    description: String(body?.description || '').slice(0, 200),
    type,
    value,
    minSubtotal: Math.max(0, Number(body?.minSubtotal || 0)),
    maxDiscount: Math.max(0, Number(body?.maxDiscount || 0)),
    startsAt: body?.startsAt ? new Date(body.startsAt) : new Date(),
    expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
    usageLimit: Math.max(0, Number(body?.usageLimit || 0)),
    perUserLimit: Math.max(0, Number(body?.perUserLimit || 1)),
    active: body?.active !== false,
    createdBy: session.user.id,
  })
  return json({ success: true, coupon: { id: coupon._id, code: coupon.code } })
}

export async function handleAdminCouponUpdate(request, id) {
  const session = await getServerSession(authOptions)
  const denied = requireRole(session, ['ADMIN'])
  if (denied) return denied
  await connectDB()
  const coupon = await Coupon.findById(id)
  if (!coupon) return err('الكوبون غير موجود', 404)
  const body = await request.json().catch(() => ({}))
  if (typeof body?.active === 'boolean') coupon.active = body.active
  if (typeof body?.description === 'string')
    coupon.description = body.description.slice(0, 200)
  if (body?.expiresAt !== undefined)
    coupon.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body?.usageLimit !== undefined)
    coupon.usageLimit = Math.max(0, Number(body.usageLimit) || 0)
  if (body?.perUserLimit !== undefined)
    coupon.perUserLimit = Math.max(0, Number(body.perUserLimit) || 0)
  coupon.updatedAt = new Date()
  await coupon.save()
  return json({ success: true })
}

export async function handleAdminCouponDelete(id) {
  const session = await getServerSession(authOptions)
  const denied = requireRole(session, ['ADMIN'])
  if (denied) return denied
  await connectDB()
  const coupon = await Coupon.findById(id)
  if (!coupon) return err('الكوبون غير موجود', 404)
  if (coupon.usedCount > 0)
    return err('لا يمكن حذف كوبون تم استخدامه — يمكنك تعطيله بدلاً من ذلك', 400)
  await Coupon.deleteOne({ _id: id })
  return json({ success: true })
}
