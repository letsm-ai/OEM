import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product, Order, Coupon, Membership, Promotion } from '@/lib/models'
import {
  COMMISSION_PERCENT,
  TIER_DISCOUNT_PERCENT,
  computeShippingFee,
  COD_EXTRA_FEE_OMR,
} from '@/lib/store'
import { findVariant } from '@/lib/variants'
import { recordStockMovement } from '@/lib/inventory'
import { applyAllPromotions } from '@/lib/promotions'
import { validateCouponForUser } from '@/lib/api/coupons'
import {
  isThawaniEnabled,
  createCheckoutSession as thawaniCreateSession,
} from '@/lib/payments/thawani'
import { finalizeOrderPayment } from '@/lib/order-finalize'

/**
 * POST /orders — full checkout flow supporting:
 *   - Authenticated buyers
 *   - Guest checkout (auto-creates a guest User; blocked if the email already has
 *     a password-protected account)
 *   - Cash on Delivery (immediate PAID) + COD extra fee
 *   - Thawani hosted-checkout (returns redirectUrl, order stays PENDING)
 *   - Legacy MOCK fallback (immediate PAID) when Thawani not configured
 *   - Server-authoritative pricing, variant stock reservation, coupon redemption
 *   - Multi-vendor line-item split with 5% commission attribution
 *
 * Body: { items:[{productId, variantId?, quantity}], shippingAddress:{name, phone,
 *         addressLine, governorate?, city?, notes?}, couponCode?, paymentMethod?,
 *         guest?:{name,email,phone} }
 */
export async function handleOrderCreate(request) {
  let session = await getServerSession(authOptions)
  await connectDB()
  const body = await request.json().catch(() => ({}))

  // Guest checkout support: if no session, require guest info to auto-create a user.
  let buyerId = session?.user?.id
  let isGuest = false
  if (!session?.user) {
    const guest = body?.guest || {}
    const gEmail = String(guest.email || '').trim().toLowerCase()
    const gName = String(guest.name || '').trim()
    const gPhone = String(guest.phone || '').trim()
    if (!gEmail || !gName) {
      return (
        NextResponse.json(
          { error: 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان' },
          { status: 400 }
        )
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail)) {
      return (
        NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
      )
    }
    // Find existing user by email; if exists and has a password, block (they should login)
    let existingUser = await User.findOne({ email: gEmail })
    if (existingUser && existingUser.password && !existingUser.isGuest) {
      return (
        NextResponse.json(
          { error: 'هذا البريد مسجّل مسبقاً، يُرجى تسجيل الدخول لإتمام الطلب' },
          { status: 409 }
        )
      )
    }
    if (existingUser) {
      // Reuse existing guest user
      buyerId = existingUser._id
      if (gName && !existingUser.name) existingUser.name = gName
      if (gPhone && !existingUser.phone) existingUser.phone = gPhone
      await existingUser.save()
    } else {
      // Create a guest user (no password — they can recover via reset-password later)
      const guestUser = await User.create({
        name: gName,
        email: gEmail,
        password: '', // empty — can't log in via credentials
        phone: gPhone,
        role: 'MEMBER',
        membershipTier: 'FREE',
        isGuest: true,
      })
      buyerId = guestUser._id
    }
    isGuest = true
  }
  if (!session?.user) {
    // For guest orders, create a shim session with the guest's buyerId
    session = { user: { id: buyerId, role: 'MEMBER' } }
  }

  const cartItems = Array.isArray(body?.items) ? body.items : []
  if (cartItems.length === 0) {
    return (
      NextResponse.json({ error: 'السلة فارغة' }, { status: 400 })
    )
  }
  const shipping = body?.shippingAddress || {}
  if (!shipping?.name || !shipping?.phone || !shipping?.addressLine) {
    return (
      NextResponse.json(
        { error: 'عنوان الشحن (الاسم، الهاتف، العنوان) مطلوب' },
        { status: 400 }
      )
    )
  }

  // Fetch authoritative product prices + stocks server-side
  const ids = cartItems.map((it) => String(it.productId))
  const uniqueIds = [...new Set(ids)]
  const products = await Product.find({
    _id: { $in: uniqueIds },
    isActive: true,
  })
  if (products.length !== uniqueIds.length) {
    return (
      NextResponse.json(
        { error: 'بعض المنتجات لم تعد متاحة' },
        { status: 409 }
      )
    )
  }
  const byId = Object.fromEntries(products.map((p) => [p._id, p]))

  const resolvedItems = []
  // Track per-variant deductions so we can decrement atomically.
  const variantDeductions = [] // { productId, variantId, qty }
  for (const it of cartItems) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1)
    const p = byId[String(it.productId)]
    if (!p) {
      return (
        NextResponse.json(
          { error: 'منتج غير موجود' },
          { status: 400 }
        )
      )
    }

    // Variant logic
    if (p.hasVariants && p.variants?.length > 0) {
      const vid = String(it.variantId || '')
      if (!vid) {
        return (
          NextResponse.json(
            { error: `يرجى اختيار خيار (متغير) للمنتج "${p.nameAr}"` },
            { status: 400 }
          )
        )
      }
      const variant = findVariant(p, vid)
      if (!variant) {
        return (
          NextResponse.json(
            { error: `الخيار المحدد للمنتج "${p.nameAr}" غير موجود` },
            { status: 400 }
          )
        )
      }
      if (variant.stock < qty) {
        return (
          NextResponse.json(
            { error: `الكمية المتاحة من "${p.nameAr} - ${variant.name}" غير كافية` },
            { status: 409 }
          )
        )
      }
      const unitPrice = variant.price > 0 ? variant.price : p.price
      resolvedItems.push({
        productId: p._id,
        vendorId: p.vendorId,
        nameAr: p.nameAr,
        image: variant.image || (p.images && p.images[0]) || '',
        unitPrice,
        quantity: qty,
        lineSubtotal: +(unitPrice * qty).toFixed(3),
        variantId: variant.id,
        variantName: variant.name,
      })
      variantDeductions.push({ productId: p._id, variantId: variant.id, qty })
      continue
    }

    // No variants — fall back to simple stock
    if (p.stock < qty) {
      return (
        NextResponse.json(
          { error: `الكمية المتاحة من "${p.nameAr}" غير كافية` },
          { status: 409 }
        )
      )
    }
    resolvedItems.push({
      productId: p._id,
      vendorId: p.vendorId,
      nameAr: p.nameAr,
      image: (p.images && p.images[0]) || '',
      unitPrice: p.price,
      quantity: qty,
      lineSubtotal: +(p.price * qty).toFixed(3),
      variantId: '',
      variantName: '',
    })
  }

  const buyer = await User.findById(session.user.id).lean()
  const tier = buyer?.membershipTier || 'FREE'
  const discountPercent = TIER_DISCOUNT_PERCENT[tier] || 0
  const subtotal = resolvedItems.reduce((s, it) => s + it.lineSubtotal, 0)

  // ----- Promotions (BUY_X_GET_Y, TIER) -----
  const now = new Date()
  const vendorIds = [...new Set(resolvedItems.map((it) => it.vendorId))]
  const activePromos = await Promotion.find({
    vendorId: { $in: vendorIds },
    isActive: true,
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
    ],
  }).lean()
  const promoResult = applyAllPromotions(resolvedItems, activePromos)
  const promoDiscount = promoResult.totalDiscount
  const afterPromos = Math.max(0, +(subtotal - promoDiscount).toFixed(3))

  // Membership tier discount is computed on the post-promo subtotal
  const discountAmount = +(afterPromos * (discountPercent / 100)).toFixed(3)
  const commissionAmount = +(afterPromos * (COMMISSION_PERCENT / 100)).toFixed(3)
  const afterTier = +(afterPromos - discountAmount).toFixed(3)

  // ----- Coupon (optional) -----
  const couponCodeRaw = String(body?.couponCode || '').trim()
  let couponDiscount = 0
  let couponRef = null
  if (couponCodeRaw) {
    const cv = await validateCouponForUser(couponCodeRaw, session.user.id, afterTier)
    if (!cv.ok) {
      return (
        NextResponse.json({ error: cv.error || 'الكوبون غير صالح' }, { status: 400 })
      )
    }
    couponDiscount = cv.discountAmount
    couponRef = cv.coupon
  }
  const afterCoupon = Math.max(0, +(afterTier - couponDiscount).toFixed(3))
  // ----- Shipping fee (based on governorate) -----
  const shippingFee = computeShippingFee(shipping.governorate, afterCoupon)
  // ----- Payment method branching -----
  const paymentMethod = String(body?.paymentMethod || '').toUpperCase() // 'COD' or empty (→ THAWANI/MOCK)
  const isCOD = paymentMethod === 'COD'
  const codFee = isCOD ? COD_EXTRA_FEE_OMR : 0
  const totalPaid = Math.max(0, +(afterCoupon + shippingFee + codFee).toFixed(3))

  // Decrement stock + salesCount atomically per product (and per-variant if applicable)
  for (const it of resolvedItems) {
    // Capture before-state for stock movement record
    const productBefore = byId[it.productId]
    let qtyBefore = 0
    if (it.variantId) {
      const v = productBefore.variants?.find((x) => x.id === it.variantId)
      qtyBefore = Number(v?.stock || 0)
    } else {
      qtyBefore = Number(productBefore?.stock || 0)
    }
    if (it.variantId) {
      // Variant-based stock: decrement the matching variant AND the aggregate stock
      await Product.updateOne(
        { _id: it.productId, 'variants.id': it.variantId },
        {
          $inc: {
            'variants.$.stock': -it.quantity,
            stock: -it.quantity,
            salesCount: it.quantity,
          },
          $set: { updatedAt: new Date() },
        }
      )
    } else {
      await Product.findByIdAndUpdate(it.productId, {
        $inc: { stock: -it.quantity, salesCount: it.quantity },
        $set: { updatedAt: new Date() },
      })
    }
    // Record SALE stock movement (fire-and-forget, best effort)
    await recordStockMovement({
      productId: it.productId,
      vendorId: it.vendorId,
      variantId: it.variantId,
      variantName: it.variantName,
      type: 'SALE',
      qtyBefore,
      qtyAfter: Math.max(0, qtyBefore - it.quantity),
      qtyDelta: -it.quantity,
      note: `بيع ضمن طلب`,
      createdBy: 'SYSTEM',
      createdByName: 'نظام المبيعات',
    })
  }

  const order = await Order.create({
    buyerId: session.user.id,
    items: resolvedItems,
    subtotal: +subtotal.toFixed(3),
    discountPercent,
    discountAmount,
    tierAtPurchase: tier,
    couponCode: couponRef ? couponRef.code : '',
    couponDiscount,
    promoDiscount,
    appliedPromotions: promoResult.appliedPromotions.map((a) => ({
      promoId: a.promoId,
      nameAr: a.nameAr,
      type: a.type,
      discount: a.discount,
      notes: a.notes || [],
    })),
    shippingFee,
    commissionPercent: COMMISSION_PERCENT,
    commissionAmount,
    totalPaid,
    shippingAddress: {
      name: String(shipping.name || '').slice(0, 80),
      phone: String(shipping.phone || '').slice(0, 30),
      governorate: String(shipping.governorate || '').slice(0, 40),
      city: String(shipping.city || '').slice(0, 60),
      addressLine: String(shipping.addressLine || '').slice(0, 300),
      notes: String(shipping.notes || '').slice(0, 300),
    },
    // Provider branch: COD = instant PAID (cash will be collected on delivery);
    // Thawani = PENDING until payment confirmation; MOCK = PAID (legacy).
    status: isCOD ? 'PAID' : isThawaniEnabled() ? 'PENDING' : 'PAID',
    paymentProvider: isCOD
      ? 'COD'
      : isThawaniEnabled()
        ? 'THAWANI'
        : 'MOCK',
    paymentStatus: isCOD ? 'PENDING' : isThawaniEnabled() ? 'PENDING' : 'PAID',
    paymentId: isCOD ? 'cod_' + Date.now() : (isThawaniEnabled() ? '' : 'mock_' + Date.now()),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // ===== BRANCH: COD (Cash on Delivery) — skip Thawani, mark paid =====
  if (isCOD) {
    await finalizeOrderPayment(order, buyer)
    return (
      NextResponse.json({
        success: true,
        cod: true,
        order: { id: order._id, ...order.toObject(), _id: undefined },
      })
    )
  }

  // ===== BRANCH: Thawani flow =====
  if (isThawaniEnabled()) {
    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000'
    const thawaniRes = await thawaniCreateSession({
      clientReferenceId: order._id,
      products: resolvedItems.map((it) => ({
        name: it.nameAr || 'منتج',
        quantity: it.quantity,
        unitAmountOmr: it.unitPrice,
      })),
      successUrl: `${origin}/store/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
      cancelUrl: `${origin}/store/checkout/cancel?order_id=${order._id}`,
      metadata: {
        order_id: order._id,
        buyer_id: String(session.user.id),
        buyer_name: buyer?.name || '',
        buyer_email: buyer?.email || '',
      },
    })
    if (!thawaniRes.ok) {
      // Mark the order as FAILED so it doesn't linger — user can retry
      order.status = 'FAILED'
      order.paymentStatus = 'FAILED'
      await order.save()
      return (
        NextResponse.json(
          { error: thawaniRes.error || 'تعذّر بدء عملية الدفع' },
          { status: 502 }
        )
      )
    }
    // Persist Thawani session info
    order.thawaniSessionId = thawaniRes.sessionId
    order.thawaniInvoice = thawaniRes.invoice || ''
    order.thawaniRedirectUrl = thawaniRes.redirectUrl
    await order.save()
    return (
      NextResponse.json({
        success: true,
        pending: true,
        orderId: order._id,
        sessionId: thawaniRes.sessionId,
        redirectUrl: thawaniRes.redirectUrl,
      })
    )
  }

  // ===== BRANCH: Legacy MOCK (mark PAID immediately) =====
  await finalizeOrderPayment(order, buyer)

  return (
    NextResponse.json({
      success: true,
      order: { id: order._id, ...order.toObject(), _id: undefined },
    })
  )
}
