import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Membership, PasswordResetToken, Company, Expert, Availability, Appointment, VendorApplication, Product, ProductReview, Order, Coupon, CouponRedemption, Cart } from '@/lib/models'

// ---- Extracted modular handlers ----
import {
  handleShippingQuote,
} from '@/lib/api/shipping'
import {
  handleWishlistList,
  handleWishlistAdd,
  handleWishlistRemove,
} from '@/lib/api/wishlist'
import {
  handleReviewsList,
  handleReviewCreate,
  handleMyReviewStatus,
} from '@/lib/api/reviews'
import {
  validateCouponForUser,
  handleCouponValidate,
  handleAdminCouponsList,
  handleAdminCouponCreate,
  handleAdminCouponUpdate,
  handleAdminCouponDelete,
} from '@/lib/api/coupons'
import {
  isThawaniEnabled,
  createCheckoutSession as thawaniCreateSession,
  getCheckoutSession as thawaniGetSession,
  verifyWebhookSignature as thawaniVerifySignature,
} from '@/lib/payments/thawani'
import {
  TIER_META,
  TIERS,
  oneYearFromNow,
  applyDiscount,
  formatArabicDate,
  canListCompany,
  tierAtLeast,
  TIER_DISCOUNT,
} from '@/lib/membership'
import { SECTOR_KEYS, GOVERNORATE_KEYS } from '@/lib/directory'
import { CATEGORY_KEYS, COMMISSION_PERCENT, TIER_DISCOUNT_PERCENT, computeShippingFee, FREE_SHIPPING_THRESHOLD, SHIPPING_FEES_OMR, COD_EXTRA_FEE_OMR } from '@/lib/store'
import { slugify, uniqueVendorSlug } from '@/lib/slug'
import { sanitizeVariants, findVariant } from '@/lib/variants'
import {
  SPECIALTY_KEYS,
  specialtyLabel,
  generateHourlySlots,
  computeSessionPrice,
} from '@/lib/experts'
import {
  sendWelcomeEmail,
  sendSubscriptionEmail,
  sendPasswordResetEmail,
  sendAppointmentConfirmationEmail,
  sendNewBookingNotifyExpert,
  sendAppointmentCancellationEmail,
  sendAppointmentReminderEmail,
  sendOrderConfirmationEmail,
  sendVendorNewOrderEmail,
  sendOrderStatusUpdateEmail,
  sendAbandonedCartEmail,
} from '@/lib/email'
import { getPaymentProvider, isRealPayment } from '@/lib/payments'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

function handleCORS(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.CORS_ORIGINS || '*'
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

/**
 * (Coupon validation helper is imported from /lib/api/coupons.js)
 */

/**
 * Idempotent post-payment side effects: decrement stock, record coupon redemption,
 * increment coupon.usedCount, send buyer+vendor emails. Safe to call multiple times
 * (uses `order.paymentProcessedSideEffects` flag).
 *
 * @param {any} order — the order Mongoose doc (or plain object with _id)
 * @param {any} buyer — user doc {_id, name, email}
 * @returns {Promise<void>}
 */
async function finalizeOrderPayment(order, buyer) {
  try {
    // Load a fresh copy (atomicity for the flag)
    const fresh = await Order.findById(order._id)
    if (!fresh) return
    if (fresh.paymentProcessedSideEffects) return // already done
    fresh.status = 'PAID'
    fresh.paymentStatus = 'PAID'
    fresh.paidAt = fresh.paidAt || new Date()
    fresh.paymentProcessedSideEffects = true
    // Push PAID entry to statusHistory (only if not already there)
    const hist = fresh.statusHistory || []
    if (!hist.some((h) => h.status === 'PAID')) {
      fresh.statusHistory = [
        ...hist,
        {
          status: 'PAID',
          changedAt: new Date(),
          changedBy: 'SYSTEM',
          actorName: 'نظام الدفع',
          note: '',
        },
      ]
    }
    await fresh.save()

    const items = fresh.items || []

    // 1) Decrement stock + increment salesCount
    for (const it of items) {
      try {
        if (it.variantId) {
          await Product.updateOne(
            { _id: it.productId, 'variants.id': it.variantId },
            {
              $inc: {
                'variants.$.stock': -Math.abs(it.quantity || 1),
                stock: -Math.abs(it.quantity || 1),
                salesCount: Math.abs(it.quantity || 1),
              },
            }
          )
        } else {
          await Product.findByIdAndUpdate(it.productId, {
            $inc: { stock: -Math.abs(it.quantity || 1), salesCount: Math.abs(it.quantity || 1) },
          })
        }
      } catch (e) {
        console.error('[order] stock decrement failed:', e)
      }
    }

    // 2) Coupon redemption
    if (fresh.couponCode && fresh.couponDiscount > 0) {
      try {
        const couponDoc = await Coupon.findOne({ code: fresh.couponCode })
        if (couponDoc) {
          const alreadyRedeemed = await CouponRedemption.findOne({
            couponId: couponDoc._id,
            orderId: fresh._id,
          })
          if (!alreadyRedeemed) {
            await CouponRedemption.create({
              couponId: couponDoc._id,
              code: couponDoc.code,
              userId: fresh.buyerId,
              orderId: fresh._id,
              amountSaved: fresh.couponDiscount,
            })
            await Coupon.findByIdAndUpdate(couponDoc._id, {
              $inc: { usedCount: 1 },
              $set: { updatedAt: new Date() },
            })
          }
        }
      } catch (e) {
        console.error('[order] coupon redemption failed:', e)
      }
    }

    // 3) Emails (fire-and-forget)
    ;(async () => {
      try {
        const orderObj = {
          id: fresh._id,
          items,
          subtotal: fresh.subtotal,
          discountPercent: fresh.discountPercent,
          discountAmount: fresh.discountAmount,
          totalPaid: fresh.totalPaid,
          shippingAddress: fresh.shippingAddress,
        }
        if (buyer?.email) {
          sendOrderConfirmationEmail({
            to: buyer.email,
            name: buyer.name,
            order: orderObj,
          }).catch((err) => console.error('[email] buyer confirm failed', err))
        }
        const byVendor = items.reduce((acc, it) => {
          acc[it.vendorId] = acc[it.vendorId] || []
          acc[it.vendorId].push(it)
          return acc
        }, {})
        const vendorIds = Object.keys(byVendor)
        const vendors = await User.find({ _id: { $in: vendorIds } })
          .select({ _id: 1, name: 1, email: 1 })
          .lean()
        for (const v of vendors) {
          const vItems = byVendor[v._id] || []
          const vSubtotal = vItems.reduce((s, it) => s + it.lineSubtotal, 0)
          const vCommission = +(vSubtotal * (COMMISSION_PERCENT / 100)).toFixed(3)
          const vNet = +(vSubtotal - vCommission).toFixed(3)
          if (v.email) {
            sendVendorNewOrderEmail({
              to: v.email,
              vendorName: v.name,
              order: orderObj,
              items: vItems,
              buyerName: buyer?.name || '',
              buyerEmail: buyer?.email || '',
              vendorSubtotal: +vSubtotal.toFixed(3),
              vendorCommission: vCommission,
              vendorNet: vNet,
            }).catch((err) => console.error('[email] vendor notify failed', err))
          }
        }
      } catch (e) {
        console.error('[order] email block failed', e)
      }
    })()
  } catch (e) {
    console.error('[finalizeOrderPayment] fatal', e)
  }
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Health
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(
        NextResponse.json({ message: 'Majles API is running' })
      )
    }

    // -------- Public shipping quote --------
    if (route === '/shipping/quote' && method === 'POST') {
      return handleShippingQuote(request)
    }

    // -------- SIGNUP --------
    if (route === '/signup' && method === 'POST') {
      const body = await request.json()
      const { name, email, password } = body || {}

      if (!name || !email || !password) {
        return handleCORS(
          NextResponse.json(
            { error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' },
            { status: 400 }
          )
        )
      }

      if (password.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await User.findOne({ email: normalizedEmail }).lean()
      if (existing) {
        return handleCORS(
          NextResponse.json(
            { error: 'البريد الإلكتروني مسجل مسبقاً' },
            { status: 409 }
          )
        )
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: 'MEMBER',
        membershipTier: 'FREE',
      })

      // Fire-and-forget welcome email (must not break signup flow)
      sendWelcomeEmail({ to: user.email, name: user.name }).catch((e) =>
        console.error('welcome email failed:', e)
      )

      return handleCORS(
        NextResponse.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            membershipTier: user.membershipTier,
          },
        })
      )
    }

    // -------- ME --------
    if (route === '/me' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          photo: user.photo || '',
          role: user.role,
          membershipTier: user.membershipTier,
          membershipExpiry: user.membershipExpiry,
          createdAt: user.createdAt,
        })
      )
    }

    // -------- PUT /me (update profile: name, phone, photo) --------
    if (route === '/me' && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const updates = {}

      if (typeof body.name === 'string') {
        const name = body.name.trim()
        if (name.length < 2 || name.length > 80) {
          return handleCORS(
            NextResponse.json(
              { error: 'الاسم يجب أن يكون بين 2 و 80 حرفاً' },
              { status: 400 }
            )
          )
        }
        updates.name = name
      }

      if (typeof body.phone === 'string') {
        const phone = body.phone.trim()
        if (phone && !/^[+\d\s-]{6,25}$/.test(phone)) {
          return handleCORS(
            NextResponse.json(
              { error: 'رقم الهاتف غير صحيح' },
              { status: 400 }
            )
          )
        }
        updates.phone = phone
      }

      if (typeof body.photo === 'string') {
        const photo = body.photo
        if (photo === '') {
          updates.photo = ''
        } else {
          // Must be a data URL image, size <= ~1.5MB base64
          if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(photo)) {
            return handleCORS(
              NextResponse.json(
                { error: 'صيغة الصورة غير مدعومة' },
                { status: 400 }
              )
            )
          }
          if (photo.length > 2_000_000) {
            return handleCORS(
              NextResponse.json(
                { error: 'حجم الصورة كبير جداً (الحد الأقصى 1.5MB)' },
                { status: 400 }
              )
            )
          }
          updates.photo = photo
        }
      }

      if (Object.keys(updates).length === 0) {
        return handleCORS(
          NextResponse.json({ error: 'لا توجد تغييرات' }, { status: 400 })
        )
      }

      await connectDB()
      const user = await User.findByIdAndUpdate(
        session.user.id,
        { $set: updates },
        { new: true }
      ).lean()
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            photo: user.photo || '',
            role: user.role,
            membershipTier: user.membershipTier,
          },
        })
      )
    }

    // -------- POST /me/change-password --------
    if (route === '/me/change-password' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const currentPassword = (body?.currentPassword || '').toString()
      const newPassword = (body?.newPassword || '').toString()

      if (!currentPassword || !newPassword) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الحالية والجديدة مطلوبتان' },
            { status: 400 }
          )
        )
      }
      if (newPassword.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }
      if (currentPassword === newPassword) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const user = await User.findById(session.user.id)
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الحالية غير صحيحة' },
            { status: 400 }
          )
        )
      }
      user.password = await bcrypt.hash(newPassword, 10)
      await user.save()
      // Invalidate any outstanding reset tokens for safety
      await PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null },
        { $set: { usedAt: new Date() } }
      )
      return handleCORS(
        NextResponse.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' })
      )
    }

    // -------- DELETE /me (delete account with password confirmation) --------
    if (route === '/me' && method === 'DELETE') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const password = (body?.password || '').toString()
      const confirm = (body?.confirm || '').toString()

      if (!password) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور مطلوبة لتأكيد الحذف' },
            { status: 400 }
          )
        )
      }
      if (confirm !== 'DELETE' && confirm !== 'حذف') {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب كتابة كلمة "حذف" لتأكيد العملية' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const user = await User.findById(session.user.id)
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      if (user.role === 'ADMIN') {
        return handleCORS(
          NextResponse.json(
            { error: 'لا يمكن حذف حساب المسؤول من هذه الصفحة' },
            { status: 403 }
          )
        )
      }
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور غير صحيحة' },
            { status: 400 }
          )
        )
      }

      const uid = user._id

      // Cancel user's future CONFIRMED appointments as client
      await Appointment.updateMany(
        { clientId: uid, status: 'CONFIRMED', date: { $gte: new Date() } },
        { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'client' } }
      )

      // If user is an expert, cancel their future appointments and remove their expert record + availability
      const expert = await Expert.findOne({ userId: uid })
      if (expert) {
        await Appointment.updateMany(
          { expertId: expert._id, status: 'CONFIRMED', date: { $gte: new Date() } },
          { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'expert' } }
        )
        await Availability.deleteMany({ expertId: expert._id })
        await Expert.deleteOne({ _id: expert._id })
      }

      // Delete user's companies
      await Company.deleteMany({ userId: uid })

      // Delete memberships & password reset tokens
      await Membership.deleteMany({ userId: uid })
      await PasswordResetToken.deleteMany({ userId: uid })

      // Finally delete user
      await User.deleteOne({ _id: uid })

      return handleCORS(
        NextResponse.json({ success: true, message: 'تم حذف الحساب' })
      )
    }

    // -------- MEMBERSHIP: SUBSCRIBE (MOCK PAYMENT) --------
    if (route === '/membership/subscribe' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const { tier } = body || {}

      if (!tier || !TIERS.includes(tier)) {
        return handleCORS(
          NextResponse.json({ error: 'باقة غير صحيحة' }, { status: 400 })
        )
      }

      if (tier === 'FREE') {
        return handleCORS(
          NextResponse.json(
            { error: 'الباقة المجانية مفعلة تلقائياً' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const meta = TIER_META[tier]
      const now = new Date()
      const endDate = oneYearFromNow(now)

      // Update user tier & expiry
      const user = await User.findByIdAndUpdate(
        session.user.id,
        {
          membershipTier: tier,
          membershipExpiry: endDate,
        },
        { new: true }
      ).lean()

      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }

      // Record membership history (mocked payment = PAID)
      const membership = await Membership.create({
        userId: user._id,
        tier,
        startDate: now,
        endDate,
        amountPaid: meta.price,
        paymentStatus: 'PAID',
      })

      // Fire-and-forget subscription email
      sendSubscriptionEmail({
        to: user.email,
        name: user.name,
        tierAr: meta.nameAr,
        amount: meta.price,
        expiryFormatted: formatArabicDate(endDate),
      }).catch((e) => console.error('subscription email failed:', e))

      return handleCORS(
        NextResponse.json({
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
      )
    }

    // -------- MEMBERSHIP HISTORY --------
    if (route === '/membership/history' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const list = await Membership.find({ userId: session.user.id })
        .sort({ startDate: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          history: list.map((m) => ({
            id: m._id,
            tier: m.tier,
            startDate: m.startDate,
            endDate: m.endDate,
            amountPaid: m.amountPaid,
            paymentStatus: m.paymentStatus,
          })),
        })
      )
    }

    // -------- DISCOUNT CALCULATOR (for cart preview / demos) --------
    if (route === '/membership/discount' && method === 'POST') {
      const session = await getServerSession(authOptions)
      const body = await request.json().catch(() => ({}))
      const { price } = body || {}
      if (typeof price !== 'number' || price < 0) {
        return handleCORS(
          NextResponse.json({ error: 'السعر غير صحيح' }, { status: 400 })
        )
      }
      
      // Fetch fresh user data from database to get current tier
      let tier = 'FREE'
      if (session?.user?.id) {
        await connectDB()
        const user = await User.findById(session.user.id).lean()
        tier = user?.membershipTier || 'FREE'
      }
      
      const result = applyDiscount(price, tier)
      return handleCORS(NextResponse.json({ tier, ...result }))
    }

    /* ============================================================
       COMPANIES
       ============================================================ */

    // Helpers
    const companyDetailMatch = route.match(/^\/companies\/([A-Za-z0-9-]+)$/)
    const adminApproveMatch = route.match(
      /^\/admin\/companies\/([A-Za-z0-9-]+)\/approve$/
    )
    const adminRejectMatch = route.match(
      /^\/admin\/companies\/([A-Za-z0-9-]+)\/reject$/
    )

    // ---- GET /companies  (public list of APPROVED) ----
    if (route === '/companies' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('search') || '').trim()
      const sector = url.searchParams.get('sector') || ''
      const gov = url.searchParams.get('governorate') || ''
      const sortParam = (url.searchParams.get('sort') || 'newest').toLowerCase()
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1),
        500
      )

      await connectDB()
      const query = { status: 'APPROVED' }
      if (sector) query.sector = sector
      if (gov) query.governorate = gov
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [
          { nameAr: rx },
          { nameEn: rx },
          { description: rx },
          { services: rx },
          { location: rx },
        ]
      }
      const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        name: { nameAr: 1 },
        name_desc: { nameAr: -1 },
      }
      const sort = sortMap[sortParam] || sortMap.newest
      const list = await Company.find(query).sort(sort).limit(limit).lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /companies  (auth + BASIC+) ----
    if (route === '/companies' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      const userTier = dbUser?.membershipTier || 'FREE'
      if (!canListCompany(userTier)) {
        return handleCORS(
          NextResponse.json(
            { error: 'تحتاج إلى باقة أساسية أو أعلى لإضافة شركة' },
            { status: 403 }
          )
        )
      }

      const body = await request.json().catch(() => ({}))
      const { nameAr, sector } = body || {}
      if (!nameAr || !sector) {
        return handleCORS(
          NextResponse.json(
            { error: 'اسم الشركة (عربي) والقطاع مطلوبان' },
            { status: 400 }
          )
        )
      }
      if (!SECTOR_KEYS.includes(sector)) {
        return handleCORS(
          NextResponse.json({ error: 'القطاع غير صحيح' }, { status: 400 })
        )
      }
      if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
        return handleCORS(
          NextResponse.json({ error: 'المحافظة غير صحيحة' }, { status: 400 })
        )
      }

      // Optional lat/lng (Oman bounding box)
      let latVal = null
      let lngVal = null
      if (body.lat !== undefined && body.lat !== null && body.lat !== '') {
        latVal = Number(body.lat)
        lngVal = Number(body.lng)
        if (
          !Number.isFinite(latVal) ||
          !Number.isFinite(lngVal) ||
          latVal < 16.6 || latVal > 27.0 ||
          lngVal < 51.5 || lngVal > 60.0
        ) {
          return handleCORS(
            NextResponse.json(
              { error: 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' },
              { status: 400 }
            )
          )
        }
      }

      const company = await Company.create({
        userId: session.user.id,
        nameAr: String(nameAr).trim(),
        nameEn: body.nameEn ? String(body.nameEn).trim() : undefined,
        sector,
        governorate: body.governorate || undefined,
        description: body.description || '',
        services: Array.isArray(body.services)
          ? body.services.slice(0, 30)
          : [],
        phone: body.phone || '',
        email: body.email || '',
        website: body.website || '',
        location: body.location || '',
        lat: latVal,
        lng: lngVal,
        logo: body.logo || '',
        status: 'PENDING',
        isApproved: false,
      })

      // Ensure status is set using update operation (workaround for schema issue)
      await Company.findByIdAndUpdate(company._id, { 
        status: 'PENDING', 
        isApproved: false,
        lat: latVal,
        lng: lngVal
      })

      const companyObj = company.toObject()
      return handleCORS(
        NextResponse.json({
          success: true,
          company: { 
            id: company._id, 
            ...companyObj, 
            _id: undefined,
            status: companyObj.status || 'PENDING',
            isApproved: companyObj.isApproved || false
          },
        })
      )
    }

    // ---- GET /companies/:id ----
    if (companyDetailMatch && method === 'GET') {
      const id = companyDetailMatch[1]
      await connectDB()
      const company = await Company.findById(id).lean()
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      // Non-approved only visible to owner or admin
      if (company.status !== 'APPROVED') {
        const session = await getServerSession(authOptions)
        const isOwner = session?.user?.id === company.userId
        const isAdmin = session?.user?.role === 'ADMIN'
        if (!isOwner && !isAdmin) {
          return handleCORS(
            NextResponse.json({ error: 'الشركة غير متاحة' }, { status: 404 })
          )
        }
      }
      const { _id, ...rest } = company
      return handleCORS(NextResponse.json({ id: _id, ...rest }))
    }

    // ---- PUT /companies/:id  (owner updates; resets to PENDING) ----
    if (companyDetailMatch && method === 'PUT') {
      const id = companyDetailMatch[1]
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const company = await Company.findById(id)
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      const isOwner = company.userId === session.user.id
      const isAdmin = session.user.role === 'ADMIN'
      if (!isOwner && !isAdmin) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
        )
      }

      const body = await request.json().catch(() => ({}))
      const allowed = [
        'nameAr',
        'nameEn',
        'sector',
        'governorate',
        'description',
        'services',
        'phone',
        'email',
        'website',
        'location',
        'logo',
      ]
      for (const k of allowed) {
        if (body[k] !== undefined) company[k] = body[k]
      }
      if (body.sector && !SECTOR_KEYS.includes(body.sector)) {
        return handleCORS(
          NextResponse.json({ error: 'القطاع غير صحيح' }, { status: 400 })
        )
      }
      if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
        return handleCORS(
          NextResponse.json({ error: 'المحافظة غير صحيحة' }, { status: 400 })
        )
      }

      // Optional lat/lng update (null/'' clears; otherwise validate Oman bbox)
      if (body.lat !== undefined) {
        if (body.lat === null || body.lat === '') {
          company.lat = null
          company.lng = null
        } else {
          const latVal = Number(body.lat)
          const lngVal = Number(body.lng)
          if (
            !Number.isFinite(latVal) ||
            !Number.isFinite(lngVal) ||
            latVal < 16.6 || latVal > 27.0 ||
            lngVal < 51.5 || lngVal > 60.0
          ) {
            return handleCORS(
              NextResponse.json(
                { error: 'الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)' },
                { status: 400 }
              )
            )
          }
          company.lat = latVal
          company.lng = lngVal
        }
      }

      // Any user edit resets approval (admin edits keep current status)
      if (!isAdmin) {
        company.status = 'PENDING'
        company.isApproved = false
        company.rejectionReason = null
      }
      company.updatedAt = new Date()
      await company.save()

      // Ensure status is updated in DB (workaround for schema issue)
      if (!isAdmin) {
        await Company.findByIdAndUpdate(company._id, { 
          status: 'PENDING', 
          isApproved: false,
          rejectionReason: null
        })
      }

      const obj = company.toObject()
      const { _id, ...rest } = obj
      return handleCORS(
        NextResponse.json({ 
          success: true, 
          company: { 
            id: _id, 
            ...rest,
            status: isAdmin ? (rest.status || 'APPROVED') : 'PENDING'
          } 
        })
      )
    }

    // ---- DELETE /companies/:id  (owner or admin) ----
    if (companyDetailMatch && method === 'DELETE') {
      const id = companyDetailMatch[1]
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const company = await Company.findById(id)
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      if (
        company.userId !== session.user.id &&
        session.user.role !== 'ADMIN'
      ) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
        )
      }
      await Company.deleteOne({ _id: id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // ---- GET /my-companies ----
    if (route === '/my-companies' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const list = await Company.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    /* ============================================================
       ADMIN
       ============================================================ */
    // ---- GET /admin/analytics (KPIs + time series for charts) ----
    if (route === '/admin/analytics' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      if (session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      await connectDB()

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      // First day of the month, 11 months ago → gives us 12 full month buckets
      const startOfMonth12 = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)
      )

      // -------- PARALLEL AGGREGATIONS --------
      const [
        totalUsers,
        usersByRole,
        usersByTier,
        paidMemberships,
        allCompleted,
        allConfirmed,
        pendingCompanies,
        pendingExperts,
        last30Signups,
        monthlySignupsAgg,
        monthlyMembershipAgg,
        monthlyRevenueAgg,
        topExperts,
      ] = await Promise.all([
        User.countDocuments({}),
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        User.aggregate([
          { $group: { _id: '$membershipTier', count: { $sum: 1 } } },
        ]),
        Membership.aggregate([
          { $match: { paymentStatus: 'PAID' } },
          {
            $group: {
              _id: '$tier',
              count: { $sum: 1 },
              revenue: { $sum: '$amountPaid' },
            },
          },
        ]),
        Appointment.aggregate([
          { $match: { status: 'COMPLETED' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              revenue: { $sum: '$totalPaid' },
            },
          },
        ]),
        Appointment.aggregate([
          { $match: { status: 'CONFIRMED' } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              revenue: { $sum: '$totalPaid' },
            },
          },
        ]),
        Company.countDocuments({ status: 'PENDING' }),
        Expert.countDocuments({ status: 'PENDING' }),
        User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        // Monthly user signups (last 12 months)
        User.aggregate([
          { $match: { createdAt: { $gte: startOfMonth12 } } },
          {
            $group: {
              _id: {
                y: { $year: '$createdAt' },
                m: { $month: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
        ]),
        // Monthly membership revenue (last 12 months)
        Membership.aggregate([
          {
            $match: {
              paymentStatus: 'PAID',
              startDate: { $gte: startOfMonth12 },
            },
          },
          {
            $group: {
              _id: {
                y: { $year: '$startDate' },
                m: { $month: '$startDate' },
              },
              count: { $sum: 1 },
              revenue: { $sum: '$amountPaid' },
            },
          },
        ]),
        // Monthly consultation revenue (last 12 months) — COMPLETED + CONFIRMED
        Appointment.aggregate([
          {
            $match: {
              status: { $in: ['COMPLETED', 'CONFIRMED'] },
              createdAt: { $gte: startOfMonth12 },
            },
          },
          {
            $group: {
              _id: {
                y: { $year: '$createdAt' },
                m: { $month: '$createdAt' },
              },
              count: { $sum: 1 },
              revenue: { $sum: '$totalPaid' },
            },
          },
        ]),
        // Top experts by rating/totalSessions
        Expert.find({ status: 'APPROVED' })
          .sort({ rating: -1, totalSessions: -1 })
          .limit(5)
          .lean(),
      ])

      // Build the 12-month scaffold (ordered)
      const monthKeys = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)
        )
        monthKeys.push({
          y: d.getUTCFullYear(),
          m: d.getUTCMonth() + 1,
          key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        })
      }
      const bucket = (agg) => {
        const map = new Map()
        for (const row of agg || []) {
          const key = `${row._id.y}-${String(row._id.m).padStart(2, '0')}`
          map.set(key, row)
        }
        return map
      }
      const mSignups = bucket(monthlySignupsAgg)
      const mMember = bucket(monthlyMembershipAgg)
      const mRev = bucket(monthlyRevenueAgg)

      const monthly = monthKeys.map(({ key, y, m }) => ({
        key,
        year: y,
        month: m,
        signups: mSignups.get(key)?.count || 0,
        memberships: mMember.get(key)?.count || 0,
        membershipRevenue: +(mMember.get(key)?.revenue || 0).toFixed(3),
        consultationRevenue: +(mRev.get(key)?.revenue || 0).toFixed(3),
        consultationBookings: mRev.get(key)?.count || 0,
      }))

      // Topline numbers
      const membershipsSold = paidMemberships.reduce(
        (s, r) => s + (r.count || 0),
        0
      )
      const membershipRevenueTotal = paidMemberships.reduce(
        (s, r) => s + (r.revenue || 0),
        0
      )
      const completedRev = allCompleted[0]?.revenue || 0
      const completedCount = allCompleted[0]?.count || 0
      const confirmedRev = allConfirmed[0]?.revenue || 0
      const confirmedCount = allConfirmed[0]?.count || 0

      // Expert user lookup for topExperts
      const topExpertUserIds = topExperts.map((e) => e.userId)
      const topExpertUsers = await User.find({
        _id: { $in: topExpertUserIds },
      })
        .select({ _id: 1, name: 1 })
        .lean()
      const topExpertUserMap = Object.fromEntries(
        topExpertUsers.map((u) => [u._id, u.name])
      )

      return handleCORS(
        NextResponse.json({
          generatedAt: now.toISOString(),
          users: {
            total: totalUsers,
            last30Days: last30Signups,
            byRole: Object.fromEntries(
              usersByRole.map((r) => [r._id || 'UNKNOWN', r.count])
            ),
            byTier: Object.fromEntries(
              usersByTier.map((r) => [r._id || 'FREE', r.count])
            ),
          },
          memberships: {
            totalSold: membershipsSold,
            totalRevenue: +membershipRevenueTotal.toFixed(3),
            byTier: paidMemberships.map((r) => ({
              tier: r._id,
              count: r.count,
              revenue: +(r.revenue || 0).toFixed(3),
            })),
          },
          consultations: {
            completedCount,
            completedRevenue: +completedRev.toFixed(3),
            confirmedCount,
            confirmedRevenue: +confirmedRev.toFixed(3),
            totalRevenue: +(completedRev + confirmedRev).toFixed(3),
          },
          pending: {
            companies: pendingCompanies,
            experts: pendingExperts,
          },
          monthly,
          topExperts: topExperts.map((e) => ({
            id: e._id,
            name: topExpertUserMap[e.userId] || 'خبير',
            specialty: e.specialty,
            specialtyAr: e.specialtyAr,
            rating: e.rating || 0,
            totalSessions: e.totalSessions || 0,
            hourlyRate: e.hourlyRate || 0,
          })),
        })
      )
    }

    // ---- GET /admin/companies?status=PENDING ----
    if (route === '/admin/companies' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      if (session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const url = new URL(request.url)
      const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
      await connectDB()
      const query = status === 'ALL' ? {} : { status }
      const list = await Company.find(query)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /admin/companies/:id/approve ----
    if (adminApproveMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminApproveMatch[1]
      await connectDB()
      const company = await Company.findByIdAndUpdate(
        id,
        {
          status: 'APPROVED',
          isApproved: true,
          rejectionReason: null,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: 'APPROVED' })
      )
    }

    // ---- POST /admin/companies/:id/reject ----
    if (adminRejectMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminRejectMatch[1]
      const body = await request.json().catch(() => ({}))
      const reason = (body?.reason || '').trim()
      if (!reason) {
        return handleCORS(
          NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
        )
      }
      await connectDB()
      const company = await Company.findByIdAndUpdate(
        id,
        {
          status: 'REJECTED',
          isApproved: false,
          rejectionReason: reason,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: 'REJECTED' })
      )
    }

    /* ============================================================
       EXPERTS & APPOINTMENTS
       ============================================================ */

    const expertDetailMatch = route.match(/^\/experts\/([A-Za-z0-9-]+)$/)
    const expertAvailMatch = route.match(
      /^\/experts\/([A-Za-z0-9-]+)\/availability$/
    )
    const expertSlotsMatch = route.match(
      /^\/experts\/([A-Za-z0-9-]+)\/slots$/
    )
    const apptCancelMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/cancel$/
    )
    const apptReviewMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/review$/
    )
    const adminExpApproveMatch = route.match(
      /^\/admin\/experts\/([A-Za-z0-9-]+)\/approve$/
    )
    const adminExpRejectMatch = route.match(
      /^\/admin\/experts\/([A-Za-z0-9-]+)\/reject$/
    )

    // Marketplace matchers
    const productDetailMatch = route.match(/^\/products\/([A-Za-z0-9-]+)$/)
    const productReviewsMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/reviews$/
    )
    const productMyReviewStatusMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/my-review-status$/
    )
    const productRelatedMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/related$/
    )
    const wishlistItemMatch = route.match(
      /^\/wishlist\/([A-Za-z0-9-]+)$/
    )
    const adminCouponActionMatch = route.match(
      /^\/admin\/coupons\/([A-Za-z0-9-]+)$/
    )
    const orderDetailMatch = route.match(/^\/orders\/([A-Za-z0-9-]+)$/)
    const orderStatusMatch = route.match(
      /^\/vendor\/orders\/([A-Za-z0-9-]+)\/status$/
    )
    const adminVendorAppActionMatch = route.match(
      /^\/admin\/vendor-applications\/([A-Za-z0-9-]+)\/(approve|reject)$/
    )
    // Vendor storefront: /vendors/:slug (slug may contain arabic + hyphens)
    const vendorBySlugMatch = route.match(
      /^\/vendors\/([^/]+?)$/
    )

    // ---- GET /experts (public, APPROVED only) ----
    if (route === '/experts' && method === 'GET') {
      const url = new URL(request.url)
      const specialty = url.searchParams.get('specialty') || ''
      await connectDB()
      const q = { status: 'APPROVED' }
      if (specialty) q.specialty = specialty
      const list = await Expert.find(q)
        .sort({ rating: -1, createdAt: -1 })
        .lean()
      const users = await User.find({ _id: { $in: list.map((e) => e.userId) } })
        .select({ _id: 1, name: 1 })
        .lean()
      const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
      return handleCORS(
        NextResponse.json({
          experts: list.map((e) => ({
            id: e._id,
            userId: e.userId,
            name: userMap[e.userId]?.name,
            specialty: e.specialty,
            specialtyAr: e.specialtyAr,
            bio: e.bio,
            photo: e.photo,
            hourlyRate: e.hourlyRate,
            experienceYears: e.experienceYears,
            rating: e.rating,
            totalSessions: e.totalSessions,
          })),
        })
      )
    }

    // ---- POST /experts/apply ----
    if (route === '/experts/apply' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      if (!tierAtLeast(dbUser?.membershipTier || 'FREE', 'GOLD')) {
        return handleCORS(
          NextResponse.json(
            { error: 'الباقة الذهبية أو البلاتينية مطلوبة لتسجيل الخبير' },
            { status: 403 }
          )
        )
      }
      const existing = await Expert.findOne({ userId: session.user.id }).lean()
      if (existing) {
        return handleCORS(
          NextResponse.json(
            { error: 'لديك طلب تسجيل خبير مسبقاً', status: existing.status },
            { status: 409 }
          )
        )
      }
      const body = await request.json().catch(() => ({}))
      const { specialty, specialtyAr, bio, experienceYears, hourlyRate, photo, cv } = body || {}
      if (!specialty || !SPECIALTY_KEYS.includes(specialty)) {
        return handleCORS(
          NextResponse.json({ error: 'التخصص غير صحيح' }, { status: 400 })
        )
      }
      if (!hourlyRate || Number(hourlyRate) <= 0) {
        return handleCORS(
          NextResponse.json({ error: 'سعر الساعة مطلوب' }, { status: 400 })
        )
      }
      const expert = await Expert.create({
        userId: session.user.id,
        specialty,
        specialtyAr: specialtyAr || specialtyLabel(specialty),
        bio: bio || '',
        experienceYears: Number(experienceYears) || 0,
        hourlyRate: Number(hourlyRate),
        photo: photo || '',
        cv: cv || '',
        status: 'PENDING',
        isApproved: false,
      })
      return handleCORS(
        NextResponse.json({
          success: true,
          expert: { id: expert._id, status: expert.status },
        })
      )
    }

    // ---- GET /experts/me ----
    if (route === '/experts/me' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const expert = await Expert.findOne({ userId: session.user.id }).lean()
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'لست خبيراً' }, { status: 404 })
        )
      }
      const { _id, ...rest } = expert
      return handleCORS(NextResponse.json({ id: _id, ...rest }))
    }

    // ---- PUT /experts/me/availability ----
    if (route === '/experts/me/availability' && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const expert = await Expert.findOne({ userId: session.user.id })
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'لست خبيراً' }, { status: 404 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const items = Array.isArray(body?.availability) ? body.availability : []
      // Validate items
      for (const it of items) {
        if (
          typeof it.dayOfWeek !== 'number' ||
          it.dayOfWeek < 0 ||
          it.dayOfWeek > 6
        ) {
          return handleCORS(
            NextResponse.json({ error: 'يوم غير صحيح' }, { status: 400 })
          )
        }
        if (!/^\d{2}:\d{2}$/.test(it.startTime) || !/^\d{2}:\d{2}$/.test(it.endTime)) {
          return handleCORS(
            NextResponse.json({ error: 'صيغة الوقت غير صحيحة' }, { status: 400 })
          )
        }
      }
      // Replace all existing
      await Availability.deleteMany({ expertId: expert._id })
      if (items.length > 0) {
        await Availability.insertMany(
          items.map((it) => ({
            expertId: expert._id,
            dayOfWeek: it.dayOfWeek,
            startTime: it.startTime,
            endTime: it.endTime,
          }))
        )
      }
      return handleCORS(NextResponse.json({ success: true, count: items.length }))
    }

    // ---- GET /experts/:id/reviews (public reviews for an expert) ----
    if (
      /^\/experts\/([A-Za-z0-9-]+)\/reviews$/.test(route) &&
      method === 'GET'
    ) {
      const id = route.match(/^\/experts\/([A-Za-z0-9-]+)\/reviews$/)[1]
      await connectDB()
      const list = await Appointment.find({
        expertId: id,
        rating: { $gte: 1 },
      })
        .sort({ reviewedAt: -1 })
        .limit(50)
        .lean()
      const clientIds = Array.from(new Set(list.map((a) => a.clientId)))
      const clients = await User.find({ _id: { $in: clientIds } })
        .select({ _id: 1, name: 1 })
        .lean()
      const clientMap = Object.fromEntries(clients.map((c) => [c._id, c]))
      return handleCORS(
        NextResponse.json({
          reviews: list.map((a) => ({
            id: a._id,
            rating: a.rating,
            comment: a.reviewComment,
            reviewedAt: a.reviewedAt,
            clientName: clientMap[a.clientId]?.name || 'عميل',
          })),
        })
      )
    }

    // ---- GET /experts/:id/availability ----
    if (expertAvailMatch && method === 'GET') {
      const id = expertAvailMatch[1]
      await connectDB()
      const list = await Availability.find({ expertId: id })
        .sort({ dayOfWeek: 1, startTime: 1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          availability: list.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        })
      )
    }

    // ---- GET /experts/:id/slots?date=YYYY-MM-DD ----
    if (expertSlotsMatch && method === 'GET') {
      const id = expertSlotsMatch[1]
      const url = new URL(request.url)
      const dateStr = url.searchParams.get('date')
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      const d = new Date(dateStr + 'T00:00:00.000Z')
      if (isNaN(d.getTime())) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      const dayOfWeek = d.getUTCDay()
      await connectDB()
      const avail = await Availability.find({
        expertId: id,
        dayOfWeek,
      }).lean()
      const slots = generateHourlySlots(avail)
      // subtract already-booked (CONFIRMED or PENDING) on same date
      const dayStart = new Date(d)
      const dayEnd = new Date(d)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      const taken = await Appointment.find({
        expertId: id,
        status: { $in: ['CONFIRMED', 'PENDING'] },
        date: { $gte: dayStart, $lt: dayEnd },
      })
        .select({ startTime: 1 })
        .lean()
      const takenSet = new Set(taken.map((a) => a.startTime))
      const available = slots.filter((s) => !takenSet.has(s.startTime))
      return handleCORS(NextResponse.json({ slots: available }))
    }

    // ---- GET /experts/:id (public) ----
    if (expertDetailMatch && method === 'GET') {
      const id = expertDetailMatch[1]
      await connectDB()
      const expert = await Expert.findById(id).lean()
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      if (expert.status !== 'APPROVED') {
        const session = await getServerSession(authOptions)
        if (
          session?.user?.id !== expert.userId &&
          session?.user?.role !== 'ADMIN'
        ) {
          return handleCORS(
            NextResponse.json({ error: 'الخبير غير متاح' }, { status: 404 })
          )
        }
      }
      const owner = await User.findById(expert.userId).select({ name: 1 }).lean()
      const { _id, ...rest } = expert
      return handleCORS(
        NextResponse.json({ id: _id, ...rest, name: owner?.name })
      )
    }

    // ---- POST /appointments (book) ----
    if (route === '/appointments' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const { expertId, date, startTime, endTime } = body || {}
      if (!expertId || !date || !startTime || !endTime) {
        return handleCORS(
          NextResponse.json({ error: 'بيانات الحجز ناقصة' }, { status: 400 })
        )
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      await connectDB()
      const expert = await Expert.findById(expertId).lean()
      if (!expert || expert.status !== 'APPROVED') {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير متاح' }, { status: 404 })
        )
      }
      if (expert.userId === session.user.id) {
        return handleCORS(
          NextResponse.json(
            { error: 'لا يمكنك حجز جلسة مع نفسك' },
            { status: 400 }
          )
        )
      }
      // validate slot is in availability and not already taken
      const day = new Date(date + 'T00:00:00.000Z')
      const dayOfWeek = day.getUTCDay()
      const availOk = await Availability.findOne({
        expertId,
        dayOfWeek,
        startTime: { $lte: startTime },
        endTime: { $gte: endTime },
      }).lean()
      if (!availOk) {
        return handleCORS(
          NextResponse.json({ error: 'الوقت غير ضمن أوقات المتاحة' }, { status: 400 })
        )
      }
      const dayEnd = new Date(day)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      const conflict = await Appointment.findOne({
        expertId,
        status: { $in: ['CONFIRMED', 'PENDING'] },
        date: { $gte: day, $lt: dayEnd },
        startTime,
      }).lean()
      if (conflict) {
        return handleCORS(
          NextResponse.json({ error: 'هذا الموعد محجوز بالفعل' }, { status: 409 })
        )
      }
      // pricing
      const client = await User.findById(session.user.id).lean()
      const clientTier = client?.membershipTier || 'FREE'
      const price = computeSessionPrice(
        expert.hourlyRate,
        TIER_DISCOUNT[clientTier] || 0
      )
      const appt = await Appointment.create({
        clientId: session.user.id,
        expertId,
        date: day,
        startTime,
        endTime,
        status: 'CONFIRMED',
        totalPaid: price.finalPrice,
        originalPrice: price.originalPrice,
        discountPercent: price.discountPercent,
      })

      // Fire-and-forget: emails to client + expert
      try {
        const expertUser = await User.findById(expert.userId)
          .select({ email: 1, name: 1 })
          .lean()
        const dateFmt = formatArabicDate(day)
        sendAppointmentConfirmationEmail({
          to: client.email,
          name: client.name,
          expertName: expertUser?.name || 'الخبير',
          dateFormatted: dateFmt,
          startTime,
          endTime,
          amount: price.finalPrice,
        }).catch((e) => console.error('[appt] client email failed:', e))
        if (expertUser?.email) {
          sendNewBookingNotifyExpert({
            to: expertUser.email,
            expertName: expertUser.name,
            clientName: client.name,
            dateFormatted: dateFmt,
            startTime,
            endTime,
            amount: price.finalPrice,
          }).catch((e) => console.error('[appt] expert email failed:', e))
        }
      } catch (emailErr) {
        console.error('[appt] email lookup failed:', emailErr)
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          appointment: {
            id: appt._id,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
            totalPaid: appt.totalPaid,
            status: appt.status,
          },
        })
      )
    }

    // ---- GET /appointments (mine as client or expert) ----
    if (route === '/appointments' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const url = new URL(request.url)
      const as = url.searchParams.get('as') || 'client' // 'client' | 'expert'
      const q = {}
      if (as === 'expert') {
        const expert = await Expert.findOne({ userId: session.user.id }).lean()
        if (!expert) {
          return handleCORS(NextResponse.json({ appointments: [] }))
        }
        q.expertId = expert._id
      } else {
        q.clientId = session.user.id
      }
      const appts = await Appointment.find(q)
        .sort({ date: -1, startTime: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          appointments: appts.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /appointments/:id/cancel ----
    if (apptCancelMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const id = apptCancelMatch[1]
      await connectDB()
      const appt = await Appointment.findById(id)
      if (!appt) {
        return handleCORS(
          NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
        )
      }
      // Must be client, expert owner, or admin
      let isExpert = false
      if (appt.clientId !== session.user.id) {
        const expert = await Expert.findById(appt.expertId).lean()
        if (expert?.userId === session.user.id) isExpert = true
        else if (session.user.role !== 'ADMIN') {
          return handleCORS(
            NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
          )
        }
      }
      if (appt.status === 'CANCELLED') {
        return handleCORS(
          NextResponse.json({ error: 'الحجز ملغي مسبقاً' }, { status: 400 })
        )
      }
      // 24h rule for clients (admin/expert bypass)
      if (!isExpert && session.user.role !== 'ADMIN') {
        const d = new Date(appt.date)
        const [h, m] = appt.startTime.split(':').map(Number)
        d.setUTCHours(h, m, 0, 0)
        const hoursUntil = (d.getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntil < 24) {
          return handleCORS(
            NextResponse.json(
              { error: 'لا يمكن الإلغاء قبل الجلسة بأقل من 24 ساعة' },
              { status: 400 }
            )
          )
        }
      }
      appt.status = 'CANCELLED'
      appt.cancelledAt = new Date()
      appt.cancelledBy = isExpert
        ? 'expert'
        : session.user.role === 'ADMIN'
        ? 'admin'
        : 'client'
      await appt.save()

      // Fire-and-forget cancellation email to client
      try {
        const client = await User.findById(appt.clientId)
          .select({ email: 1, name: 1 })
          .lean()
        const expert = await Expert.findById(appt.expertId).lean()
        const expertUser = expert
          ? await User.findById(expert.userId).select({ name: 1 }).lean()
          : null
        if (client?.email) {
          sendAppointmentCancellationEmail({
            to: client.email,
            name: client.name,
            expertName: expertUser?.name || 'الخبير',
            dateFormatted: formatArabicDate(appt.date),
            startTime: appt.startTime,
            cancelledBy: appt.cancelledBy,
          }).catch((e) => console.error('[cancel] email failed:', e))
        }
      } catch (e) {
        console.error('[cancel] email lookup failed:', e)
      }

      return handleCORS(NextResponse.json({ success: true }))
    }

    // ---- POST /appointments/:id/review (client rates expert after session) ----
    if (apptReviewMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const id = apptReviewMatch[1]
      const body = await request.json().catch(() => ({}))
      const rating = Number(body?.rating)
      const comment = (body?.comment || '').toString().slice(0, 1000)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return handleCORS(
          NextResponse.json({ error: 'التقييم يجب أن يكون بين 1 و 5 نجوم' }, { status: 400 })
        )
      }

      await connectDB()
      const appt = await Appointment.findById(id)
      if (!appt) {
        return handleCORS(
          NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
        )
      }
      if (appt.clientId !== session.user.id) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكنك تقييم جلسة ليست لك' }, { status: 403 })
        )
      }
      // Must be a past appointment (end datetime passed)
      const apptEnd = new Date(appt.date)
      const [eh, em] = (appt.endTime || '00:00').split(':').map(Number)
      apptEnd.setUTCHours(eh, em, 0, 0)
      if (apptEnd > new Date()) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكن التقييم قبل انتهاء الجلسة' }, { status: 400 })
        )
      }
      if (appt.status === 'CANCELLED') {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكن تقييم جلسة ملغاة' }, { status: 400 })
        )
      }
      if (appt.reviewedAt) {
        return handleCORS(
          NextResponse.json({ error: 'لقد قمت بتقييم هذه الجلسة مسبقاً' }, { status: 409 })
        )
      }

      appt.rating = rating
      appt.reviewComment = comment
      appt.reviewedAt = new Date()
      if (appt.status === 'CONFIRMED') appt.status = 'COMPLETED'
      await appt.save()

      // Recompute expert aggregate rating & session count
      const agg = await Appointment.aggregate([
        {
          $match: {
            expertId: appt.expertId,
            rating: { $gte: 1 },
          },
        },
        {
          $group: {
            _id: '$expertId',
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      const row = agg[0]
      const completedCount = await Appointment.countDocuments({
        expertId: appt.expertId,
        status: 'COMPLETED',
      })
      await Expert.updateOne(
        { _id: appt.expertId },
        {
          $set: {
            rating: row ? Number(row.avg.toFixed(2)) : 0,
            totalSessions: completedCount,
          },
        }
      )

      return handleCORS(
        NextResponse.json({ success: true, appointment: { id: appt._id, rating, comment, status: appt.status } })
      )
    }
    if (route === '/admin/experts' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const url = new URL(request.url)
      const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
      await connectDB()
      const q = status === 'ALL' ? {} : { status }
      const list = await Expert.find(q).sort({ createdAt: -1 }).lean()
      return handleCORS(
        NextResponse.json({
          experts: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    if (adminExpApproveMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminExpApproveMatch[1]
      await connectDB()
      const updated = await Expert.findByIdAndUpdate(
        id,
        {
          status: 'APPROVED',
          isApproved: true,
          rejectionReason: null,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!updated) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      // promote user role to EXPERT
      await User.findByIdAndUpdate(updated.userId, { role: 'EXPERT' })
      return handleCORS(
        NextResponse.json({ success: true, status: updated.status })
      )
    }

    if (adminExpRejectMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminExpRejectMatch[1]
      const body = await request.json().catch(() => ({}))
      const reason = (body?.reason || '').trim()
      if (!reason) {
        return handleCORS(
          NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
        )
      }
      await connectDB()
      const updated = await Expert.findByIdAndUpdate(
        id,
        {
          status: 'REJECTED',
          isApproved: false,
          rejectionReason: reason,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!updated) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: updated.status })
      )
    }



    // -------- CRON: send 24h reminders --------
    // Triggered by an external scheduler (cron-job.org, UptimeRobot, vercel cron, etc.)
    // hitting this URL every hour:
    //   POST {BASE_URL}/api/cron/send-reminders
    //   Header: Authorization: Bearer ${CRON_SECRET}
    if (route === '/cron/send-reminders' && method === 'POST') {
      const auth = request.headers.get('authorization') || ''
      const secret = process.env.CRON_SECRET
      if (!secret) {
        return handleCORS(
          NextResponse.json(
            { error: 'CRON_SECRET غير مضبوط في البيئة' },
            { status: 500 }
          )
        )
      }
      if (auth !== `Bearer ${secret}`) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }

      await connectDB()
      const now = new Date()
      // Window: appointments starting between now+23h and now+25h, not yet reminded, still CONFIRMED.
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

      // Fetch all CONFIRMED that might be tomorrow and not reminded
      const dayStartCandidate = new Date(windowStart)
      dayStartCandidate.setUTCHours(0, 0, 0, 0)
      const dayEndCandidate = new Date(windowEnd)
      dayEndCandidate.setUTCHours(23, 59, 59, 999)

      const candidates = await Appointment.find({
        status: 'CONFIRMED',
        reminderSentAt: null,
        date: { $gte: dayStartCandidate, $lte: dayEndCandidate },
      }).lean()

      const toRemind = candidates.filter((a) => {
        const d = new Date(a.date)
        const [h, m] = (a.startTime || '00:00').split(':').map(Number)
        d.setUTCHours(h, m, 0, 0)
        return d >= windowStart && d <= windowEnd
      })

      let sent = 0
      let failed = 0
      for (const appt of toRemind) {
        try {
          const client = await User.findById(appt.clientId)
            .select({ email: 1, name: 1 })
            .lean()
          const expert = await Expert.findById(appt.expertId).lean()
          const expertUser = expert
            ? await User.findById(expert.userId).select({ name: 1 }).lean()
            : null
          if (client?.email) {
            await sendAppointmentReminderEmail({
              to: client.email,
              name: client.name,
              expertName: expertUser?.name || 'الخبير',
              dateFormatted: formatArabicDate(appt.date),
              startTime: appt.startTime,
              endTime: appt.endTime,
            })
          }
          await Appointment.updateOne(
            { _id: appt._id },
            { $set: { reminderSentAt: new Date() } }
          )
          sent += 1
        } catch (err) {
          console.error('[cron] reminder failed for', appt._id, err)
          failed += 1
        }
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          considered: toRemind.length,
          sent,
          failed,
        })
      )
    }

    // -------- PAYMENT WEBHOOK (generic, routes to configured provider) --------
    if (route === '/payments/webhook' && method === 'POST') {
      try {
        const provider = getPaymentProvider()
        const event = await provider.parseWebhook(request)
        if (!event) {
          return handleCORS(
            NextResponse.json({ received: false }, { status: 400 })
          )
        }
        // At this layer we just acknowledge. Actual state mutation (mark
        // Membership/Appointment as PAID) should be wired based on metadata
        // when switching from 'mock' to a real gateway like Thawani.
        console.log('[payments] webhook', provider.name, event)
        return handleCORS(
          NextResponse.json({ received: true, sessionId: event.sessionId })
        )
      } catch (err) {
        console.error('[payments] webhook error:', err)
        return handleCORS(
          NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        )
      }
    }

    // -------- FORGOT PASSWORD --------
    if (route === '/forgot-password' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { email } = body || {}
      if (!email || typeof email !== 'string') {
        return handleCORS(
          NextResponse.json(
            { error: 'البريد الإلكتروني مطلوب' },
            { status: 400 }
          )
        )
      }
      const normalizedEmail = email.toLowerCase().trim()

      await connectDB()
      const user = await User.findOne({ email: normalizedEmail }).lean()

      // Always respond success to avoid email enumeration
      if (user) {
        // Invalidate any previous active tokens
        await PasswordResetToken.updateMany(
          { userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } },
          { $set: { usedAt: new Date() } }
        )

        const rawToken = crypto.randomBytes(32).toString('hex')
        const tokenHash = sha256(rawToken)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        await PasswordResetToken.create({
          userId: user._id,
          tokenHash,
          expiresAt,
        })

        const resetUrl = `${BASE_URL}/reset-password?token=${rawToken}`
        sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        }).catch((e) => console.error('reset email failed:', e))
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          message:
            'إذا كان البريد مسجلاً لدينا، فسيصلك رابط إعادة تعيين كلمة المرور',
        })
      )
    }

    // -------- RESET PASSWORD --------
    if (route === '/reset-password' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { token, password } = body || {}

      if (!token || !password) {
        return handleCORS(
          NextResponse.json(
            { error: 'الرابط وكلمة المرور مطلوبة' },
            { status: 400 }
          )
        )
      }
      if (password.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const tokenHash = sha256(token)
      const resetDoc = await PasswordResetToken.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })

      if (!resetDoc) {
        return handleCORS(
          NextResponse.json(
            {
              error:
                'الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد',
            },
            { status: 400 }
          )
        )
      }

      const hashed = await bcrypt.hash(password, 10)
      await User.findByIdAndUpdate(resetDoc.userId, { password: hashed })

      // Mark token used
      resetDoc.usedAt = new Date()
      await resetDoc.save()

      return handleCORS(
        NextResponse.json({
          success: true,
          message: 'تم تحديث كلمة المرور بنجاح',
        })
      )
    }

    /* ============================================================
       MARKETPLACE — VENDOR APPLICATIONS
       ============================================================ */
    // ---- GET /vendor/application (my application status, if any) ----
    if (route === '/vendor/application' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const app = await VendorApplication.findOne({
        userId: session.user.id,
      }).lean()
      const user = await User.findById(session.user.id).lean()
      return handleCORS(
        NextResponse.json({
          application: app
            ? { id: app._id, ...app, _id: undefined }
            : null,
          isVendor: user?.role === 'VENDOR' || user?.role === 'ADMIN',
          tier: user?.membershipTier || 'FREE',
        })
      )
    }

    // ---- POST /vendor/apply (GOLD/PLATINUM only) ----
    if (route === '/vendor/apply' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      if (!dbUser) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      if (dbUser.role === 'VENDOR' || dbUser.role === 'ADMIN') {
        return handleCORS(
          NextResponse.json(
            { error: 'أنت بائع بالفعل' },
            { status: 400 }
          )
        )
      }
      if (!['GOLD', 'PLATINUM'].includes(dbUser.membershipTier)) {
        return handleCORS(
          NextResponse.json(
            { error: 'تحتاج إلى عضوية ذهبية أو بلاتينية للتقديم كبائع' },
            { status: 403 }
          )
        )
      }
      const body = await request.json().catch(() => ({}))
      const businessName = String(body?.businessName || '').trim()
      if (!businessName || businessName.length < 2) {
        return handleCORS(
          NextResponse.json(
            { error: 'اسم المتجر/النشاط مطلوب' },
            { status: 400 }
          )
        )
      }
      const existing = await VendorApplication.findOne({
        userId: session.user.id,
      })
      if (existing && existing.status === 'PENDING') {
        return handleCORS(
          NextResponse.json(
            { error: 'لديك طلب قيد المراجعة بالفعل' },
            { status: 409 }
          )
        )
      }
      const doc = {
        userId: session.user.id,
        businessName,
        businessDescription: String(body?.businessDescription || '').slice(0, 2000),
        phone: String(body?.phone || '').slice(0, 30),
        status: 'PENDING',
        adminNote: '',
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      }
      let saved
      if (existing) {
        saved = await VendorApplication.findByIdAndUpdate(
          existing._id,
          { $set: doc },
          { new: true }
        ).lean()
      } else {
        saved = (
          await VendorApplication.create({ ...doc, createdAt: new Date() })
        ).toObject()
      }
      return handleCORS(
        NextResponse.json({
          success: true,
          application: { id: saved._id, ...saved, _id: undefined },
        })
      )
    }

    // ---- GET /admin/vendor-applications?status= (admin) ----
    if (route === '/admin/vendor-applications' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      if (session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      await connectDB()
      const url = new URL(request.url)
      const statusFilter = (url.searchParams.get('status') || '').toUpperCase()
      const q = {}
      if (['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
        q.status = statusFilter
      }
      const apps = await VendorApplication.find(q)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
      const userIds = apps.map((a) => a.userId)
      const users = await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, name: 1, email: 1, membershipTier: 1, role: 1 })
        .lean()
      const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
      return handleCORS(
        NextResponse.json({
          applications: apps.map((a) => ({
            id: a._id,
            ...a,
            _id: undefined,
            user: userMap[a.userId]
              ? {
                  id: userMap[a.userId]._id,
                  name: userMap[a.userId].name,
                  email: userMap[a.userId].email,
                  membershipTier: userMap[a.userId].membershipTier,
                  role: userMap[a.userId].role,
                }
              : null,
          })),
        })
      )
    }

    // ---- POST /admin/vendor-applications/:id/(approve|reject) (admin) ----
    if (adminVendorAppActionMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      if (session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminVendorAppActionMatch[1]
      const action = adminVendorAppActionMatch[2] // approve | reject
      const body = await request.json().catch(() => ({}))
      await connectDB()
      const app = await VendorApplication.findById(id)
      if (!app) {
        return handleCORS(
          NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
        )
      }
      app.status = action === 'approve' ? 'APPROVED' : 'REJECTED'
      app.adminNote = String(body?.note || '').slice(0, 500)
      app.reviewedBy = session.user.id
      app.reviewedAt = new Date()
      app.updatedAt = new Date()
      await app.save()
      if (action === 'approve') {
        // Ensure the approved user has a vendor profile with a unique slug.
        const approvedUser = await User.findById(app.userId)
        if (approvedUser) {
          const existingSlug = approvedUser.vendorProfile?.slug
          let slug = existingSlug
          if (!slug) {
            slug = await uniqueVendorSlug(User, app.businessName, approvedUser._id)
          }
          approvedUser.role = 'VENDOR'
          approvedUser.vendorProfile = {
            slug,
            businessName: app.businessName || approvedUser.name,
            tagline: approvedUser.vendorProfile?.tagline || '',
            bio: approvedUser.vendorProfile?.bio || app.businessDescription || '',
            banner: approvedUser.vendorProfile?.banner || '',
            logo: approvedUser.vendorProfile?.logo || approvedUser.photo || '',
            phone: approvedUser.vendorProfile?.phone || app.phone || approvedUser.phone || '',
            whatsapp: approvedUser.vendorProfile?.whatsapp || '',
            instagram: approvedUser.vendorProfile?.instagram || '',
            website: approvedUser.vendorProfile?.website || '',
            governorate: approvedUser.vendorProfile?.governorate || '',
            city: approvedUser.vendorProfile?.city || '',
            address: approvedUser.vendorProfile?.address || '',
          }
          await approvedUser.save()
        }
      }
      return handleCORS(
        NextResponse.json({
          success: true,
          application: { id: app._id, ...app.toObject(), _id: undefined },
        })
      )
    }

    /* ============================================================
       MARKETPLACE — PRODUCTS
       ============================================================ */
    // ---- GET /products (public list of active products) ----
    if (route === '/products' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('search') || '').trim()
      const category = url.searchParams.get('category') || ''
      const sort = (url.searchParams.get('sort') || 'newest').toLowerCase()
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1),
        500
      )
      await connectDB()
      const query = { isActive: true }
      if (category && CATEGORY_KEYS.includes(category)) {
        query.category = category
      }
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }]
      }
      const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        price_asc: { price: 1 },
        price_desc: { price: -1 },
        popular: { salesCount: -1 },
      }
      const sortObj = sortMap[sort] || sortMap.newest
      const products = await Product.find(query)
        .sort(sortObj)
        .limit(limit)
        .lean()
      const vendorIds = Array.from(new Set(products.map((p) => p.vendorId)))
      const vendors = await User.find({
        _id: { $in: vendorIds },
        role: { $in: ['VENDOR', 'ADMIN'] },
      })
        .select({ _id: 1, name: 1, vendorProfile: 1 })
        .lean()
      const vendorMap = Object.fromEntries(
        vendors.map((v) => [
          v._id,
          {
            name: v.vendorProfile?.businessName || v.name,
            slug: v.vendorProfile?.slug || '',
            logo: v.vendorProfile?.logo || '',
          },
        ])
      )
      return handleCORS(
        NextResponse.json({
          products: products
            .filter((p) => vendorMap[p.vendorId]) // hide orphaned products
            .map((p) => ({
              id: p._id,
              ...p,
              _id: undefined,
              vendorName: vendorMap[p.vendorId]?.name || 'تاجر',
              vendorSlug: vendorMap[p.vendorId]?.slug || '',
              vendorLogo: vendorMap[p.vendorId]?.logo || '',
            })),
        })
      )
    }

    // ---- GET /products/:id (public detail) ----
    if (productDetailMatch && method === 'GET') {
      await connectDB()
      const id = productDetailMatch[1]
      const p = await Product.findById(id).lean()
      if (!p) {
        return handleCORS(
          NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
        )
      }
      const vendor = await User.findById(p.vendorId)
        .select({ _id: 1, name: 1, email: 1, role: 1, vendorProfile: 1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          product: {
            id: p._id,
            ...p,
            _id: undefined,
            vendor: vendor
              ? {
                  id: vendor._id,
                  name: vendor.vendorProfile?.businessName || vendor.name,
                  slug: vendor.vendorProfile?.slug || '',
                  logo: vendor.vendorProfile?.logo || '',
                  tagline: vendor.vendorProfile?.tagline || '',
                  role: vendor.role,
                }
              : null,
          },
        })
      )
    }

    // ---- Product Reviews (see /lib/api/reviews.js) ----
    if (productReviewsMatch && method === 'GET') {
      return handleReviewsList(productReviewsMatch[1])
    }
    if (productReviewsMatch && method === 'POST') {
      return handleReviewCreate(request, productReviewsMatch[1])
    }
    if (productMyReviewStatusMatch && method === 'GET') {
      return handleMyReviewStatus(productMyReviewStatusMatch[1])
    }

    // ---- GET /products/:id/related (public — related products) ----
    if (productRelatedMatch && method === 'GET') {
      await connectDB()
      const id = productRelatedMatch[1]
      const p = await Product.findById(id).select({ _id: 1, vendorId: 1, category: 1 }).lean()
      if (!p) {
        return handleCORS(
          NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
        )
      }
      const limit = 8
      // 1st pass: same category (exclude self)
      let related = await Product.find({
        _id: { $ne: id },
        category: p.category,
        isActive: true,
        stock: { $gt: 0 },
      })
        .sort({ salesCount: -1, createdAt: -1 })
        .limit(limit)
        .lean()
      // Fallback: if fewer than limit, fetch more from same vendor (any category)
      if (related.length < limit) {
        const existingIds = new Set(related.map((r) => r._id))
        existingIds.add(id)
        const fill = await Product.find({
          _id: { $nin: [...existingIds] },
          vendorId: p.vendorId,
          isActive: true,
          stock: { $gt: 0 },
        })
          .sort({ createdAt: -1 })
          .limit(limit - related.length)
          .lean()
        related = [...related, ...fill]
      }
      // Final fallback: any active product with stock
      if (related.length < limit) {
        const existingIds = new Set(related.map((r) => r._id))
        existingIds.add(id)
        const fill = await Product.find({
          _id: { $nin: [...existingIds] },
          isActive: true,
          stock: { $gt: 0 },
        })
          .sort({ salesCount: -1, createdAt: -1 })
          .limit(limit - related.length)
          .lean()
        related = [...related, ...fill]
      }
      // Attach vendor slug/name for nice UI
      const vendorIds = [...new Set(related.map((r) => r.vendorId))]
      const vendors = await User.find({ _id: { $in: vendorIds } })
        .select({ _id: 1, name: 1, vendorProfile: 1 })
        .lean()
      const vMap = Object.fromEntries(vendors.map((v) => [v._id, v]))
      return handleCORS(
        NextResponse.json({
          products: related.map((r) => ({
            id: r._id,
            ...r,
            _id: undefined,
            vendorName:
              vMap[r.vendorId]?.vendorProfile?.businessName ||
              vMap[r.vendorId]?.name ||
              'تاجر',
            vendorSlug: vMap[r.vendorId]?.vendorProfile?.slug || '',
          })),
        })
      )
    }

    // ---- Wishlist (see /lib/api/wishlist.js) ----
    if (route === '/wishlist' && method === 'GET') {
      return handleWishlistList()
    }
    if (wishlistItemMatch && method === 'POST') {
      return handleWishlistAdd(wishlistItemMatch[1])
    }
    if (wishlistItemMatch && method === 'DELETE') {
      return handleWishlistRemove(wishlistItemMatch[1])
    }


    /* ============================================================
       MARKETPLACE — CART SYNC (for abandoned-cart reminders)
       ============================================================ */
    // ---- POST /cart (auth) — upsert user's cart ----
    if (route === '/cart' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const body = await request.json().catch(() => ({}))
      const rawItems = Array.isArray(body?.items) ? body.items : []
      const items = rawItems.slice(0, 100).map((it) => ({
        productId: String(it.productId || ''),
        quantity: Math.max(1, Math.min(99, parseInt(it.quantity || 1, 10))),
        nameAr: String(it.nameAr || '').slice(0, 100),
        unitPrice: Number(it.unitPrice || 0),
        image: String(it.image || '').slice(0, 2000),
      })).filter((it) => it.productId)
      await Cart.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            items,
            updatedAt: new Date(),
            // Reset reminder counters on activity
            lastReminderSentAt: null,
            reminderEmailsSent: 0,
          },
        },
        { upsert: true, new: true }
      )
      return handleCORS(NextResponse.json({ success: true, count: items.length }))
    }

    // ---- GET /cart (auth) — fetch saved cart ----
    if (route === '/cart' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ items: [] })
        )
      }
      await connectDB()
      const c = await Cart.findOne({ userId: session.user.id }).lean()
      return handleCORS(NextResponse.json({ items: c?.items || [] }))
    }

    // ---- DELETE /cart (auth) — clear cart (after order success) ----
    if (route === '/cart' && method === 'DELETE') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ success: true })
        )
      }
      await connectDB()
      await Cart.findOneAndUpdate(
        { userId: session.user.id },
        { $set: { items: [], updatedAt: new Date() } },
        { upsert: true }
      )
      return handleCORS(NextResponse.json({ success: true }))
    }

    /* ============================================================
       CRON — ABANDONED CART REMINDER EMAILS
       ============================================================ */
    // ---- POST /cron/abandoned-carts (requires X-CRON-KEY header OR ADMIN) ----
    if (route === '/cron/abandoned-carts' && method === 'POST') {
      // Auth: either cron key header or ADMIN session
      const cronKey = request.headers.get('x-cron-key') || ''
      const expectedKey = process.env.CRON_SECRET_KEY || ''
      let authorized = false
      if (expectedKey && cronKey === expectedKey) {
        authorized = true
      } else {
        const session = await getServerSession(authOptions)
        if (session?.user?.role === 'ADMIN') authorized = true
      }
      if (!authorized) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      // Find carts with items, updated 24..72 hours ago, and reminderEmailsSent < 1
      const now = Date.now()
      const minAge = new Date(now - 24 * 60 * 60 * 1000) // >= 24h old
      const maxAge = new Date(now - 72 * 60 * 60 * 1000) // <= 72h old
      const candidates = await Cart.find({
        'items.0': { $exists: true }, // at least 1 item
        updatedAt: { $lte: minAge, $gte: maxAge },
        reminderEmailsSent: { $lt: 1 },
      }).limit(100).lean()

      let sent = 0
      for (const c of candidates) {
        try {
          const user = await User.findById(c.userId).select({ _id:1, name:1, email:1 }).lean()
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
      return handleCORS(
        NextResponse.json({ success: true, candidates: candidates.length, sent })
      )
    }




    // ---- POST /products (vendor only) ----
    if (route === '/products' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      if (!dbUser) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      if (dbUser.role !== 'VENDOR' && dbUser.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json(
            { error: 'صلاحيات بائع مطلوبة' },
            { status: 403 }
          )
        )
      }
      const body = await request.json().catch(() => ({}))
      const nameAr = String(body?.nameAr || '').trim()
      const price = Number(body?.price)
      const category = String(body?.category || '').trim()
      if (!nameAr || nameAr.length < 2) {
        return handleCORS(
          NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
        )
      }
      if (!Number.isFinite(price) || price < 0) {
        return handleCORS(
          NextResponse.json({ error: 'السعر غير صحيح' }, { status: 400 })
        )
      }
      if (!CATEGORY_KEYS.includes(category)) {
        return handleCORS(
          NextResponse.json({ error: 'الفئة غير صحيحة' }, { status: 400 })
        )
      }
      const images = Array.isArray(body?.images)
        ? body.images
            .filter(
              (s) =>
                typeof s === 'string' &&
                /^data:image\/(png|jpe?g|webp|gif);base64,/.test(s) &&
                s.length <= 2_000_000
            )
            .slice(0, 5)
        : []
      const stock = Math.max(0, parseInt(body?.stock || 0, 10) || 0)
      // Variants (optional)
      const vres = sanitizeVariants(body?.variants)
      if (!vres.ok) {
        return handleCORS(
          NextResponse.json({ error: vres.error }, { status: 400 })
        )
      }
      const product = await Product.create({
        vendorId: session.user.id,
        nameAr,
        nameEn: String(body?.nameEn || '').trim(),
        description: String(body?.description || '').slice(0, 3000),
        price: +price.toFixed(3),
        category,
        images,
        // If variants exist, stock is the sum across variants; otherwise use the plain stock input.
        stock: vres.hasVariants ? vres.aggregatedStock : stock,
        hasVariants: vres.hasVariants,
        variants: vres.variants,
        isActive: true,
        salesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const po = product.toObject()
      return handleCORS(
        NextResponse.json({
          success: true,
          product: { id: product._id, ...po, _id: undefined },
        })
      )
    }

    // ---- PUT /products/:id (owner or admin) ----
    if (productDetailMatch && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const id = productDetailMatch[1]
      const product = await Product.findById(id)
      if (!product) {
        return handleCORS(
          NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
        )
      }
      const isOwner = product.vendorId === session.user.id
      const isAdmin = session.user.role === 'ADMIN'
      if (!isOwner && !isAdmin) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكنك تعديل هذا المنتج' }, { status: 403 })
        )
      }
      const body = await request.json().catch(() => ({}))
      if (body.nameAr !== undefined) {
        const v = String(body.nameAr).trim()
        if (v.length < 2) {
          return handleCORS(
            NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
          )
        }
        product.nameAr = v
      }
      if (body.nameEn !== undefined) product.nameEn = String(body.nameEn).trim()
      if (body.description !== undefined)
        product.description = String(body.description).slice(0, 3000)
      if (body.price !== undefined) {
        const p = Number(body.price)
        if (!Number.isFinite(p) || p < 0) {
          return handleCORS(
            NextResponse.json({ error: 'السعر غير صحيح' }, { status: 400 })
          )
        }
        product.price = +p.toFixed(3)
      }
      if (body.category !== undefined) {
        if (!CATEGORY_KEYS.includes(body.category)) {
          return handleCORS(
            NextResponse.json({ error: 'الفئة غير صحيحة' }, { status: 400 })
          )
        }
        product.category = body.category
      }
      if (body.stock !== undefined) {
        product.stock = Math.max(0, parseInt(body.stock, 10) || 0)
      }
      if (body.isActive !== undefined) product.isActive = !!body.isActive
      // Variants (if provided, replace whole array)
      if (body.variants !== undefined) {
        const vres = sanitizeVariants(body.variants)
        if (!vres.ok) {
          return handleCORS(
            NextResponse.json({ error: vres.error }, { status: 400 })
          )
        }
        product.variants = vres.variants
        product.hasVariants = vres.hasVariants
        if (vres.hasVariants) {
          // when variants exist, overall stock becomes the sum
          product.stock = vres.aggregatedStock
        }
      }
      if (Array.isArray(body.images)) {
        product.images = body.images
          .filter(
            (s) =>
              typeof s === 'string' &&
              /^data:image\/(png|jpe?g|webp|gif);base64,/.test(s) &&
              s.length <= 2_000_000
          )
          .slice(0, 5)
      }
      product.updatedAt = new Date()
      await product.save()
      const po = product.toObject()
      return handleCORS(
        NextResponse.json({
          success: true,
          product: { id: product._id, ...po, _id: undefined },
        })
      )
    }

    // ---- DELETE /products/:id (owner or admin; hard delete if no orders, else soft) ----
    if (productDetailMatch && method === 'DELETE') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const id = productDetailMatch[1]
      const product = await Product.findById(id)
      if (!product) {
        return handleCORS(
          NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
        )
      }
      const isOwner = product.vendorId === session.user.id
      const isAdmin = session.user.role === 'ADMIN'
      if (!isOwner && !isAdmin) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكنك حذف هذا المنتج' }, { status: 403 })
        )
      }
      // If the product was ever ordered, soft delete (deactivate)
      const orderedBefore = await Order.exists({
        'items.productId': product._id,
      })
      if (orderedBefore) {
        product.isActive = false
        product.updatedAt = new Date()
        await product.save()
        return handleCORS(
          NextResponse.json({ success: true, softDelete: true })
        )
      }
      await Product.deleteOne({ _id: product._id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // ---- GET /vendor/products (my products) ----
    if (route === '/vendor/products' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
        )
      }
      const products = await Product.find({ vendorId: session.user.id })
        .sort({ createdAt: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          products: products.map((p) => ({
            id: p._id,
            ...p,
            _id: undefined,
          })),
        })
      )
    }

    /* ============================================================
       VENDOR STOREFRONT (public)
       ============================================================ */
    // ---- GET /vendors (public list of approved vendors) ----
    if (route === '/vendors' && method === 'GET') {
      await connectDB()
      const vendors = await User.find({
        role: { $in: ['VENDOR', 'ADMIN'] },
        'vendorProfile.slug': { $ne: '' },
      })
        .select({
          _id: 1,
          name: 1,
          vendorProfile: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      // Product counts per vendor
      const ids = vendors.map((v) => v._id)
      const counts = await Product.aggregate([
        { $match: { vendorId: { $in: ids }, isActive: true } },
        { $group: { _id: '$vendorId', count: { $sum: 1 } } },
      ])
      const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]))
      return handleCORS(
        NextResponse.json({
          vendors: vendors
            .filter((v) => (countMap[v._id] || 0) > 0)
            .map((v) => ({
              id: v._id,
              name: v.name,
              slug: v.vendorProfile?.slug || '',
              businessName: v.vendorProfile?.businessName || v.name,
              tagline: v.vendorProfile?.tagline || '',
              logo: v.vendorProfile?.logo || '',
              banner: v.vendorProfile?.banner || '',
              governorate: v.vendorProfile?.governorate || '',
              city: v.vendorProfile?.city || '',
              productCount: countMap[v._id] || 0,
            })),
        })
      )
    }

    // ---- GET /vendors/:slug (public vendor storefront) ----
    if (vendorBySlugMatch && method === 'GET') {
      await connectDB()
      const slug = decodeURIComponent(vendorBySlugMatch[1])
      const vendor = await User.findOne({
        'vendorProfile.slug': slug,
        role: { $in: ['VENDOR', 'ADMIN'] },
      })
        .select({
          _id: 1,
          name: 1,
          vendorProfile: 1,
          createdAt: 1,
          membershipTier: 1,
        })
        .lean()
      if (!vendor) {
        return handleCORS(
          NextResponse.json({ error: 'المتجر غير موجود' }, { status: 404 })
        )
      }
      const products = await Product.find({
        vendorId: vendor._id,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      return handleCORS(
        NextResponse.json({
          vendor: {
            id: vendor._id,
            name: vendor.name,
            slug: vendor.vendorProfile?.slug,
            businessName: vendor.vendorProfile?.businessName || vendor.name,
            tagline: vendor.vendorProfile?.tagline || '',
            bio: vendor.vendorProfile?.bio || '',
            banner: vendor.vendorProfile?.banner || '',
            logo: vendor.vendorProfile?.logo || '',
            phone: vendor.vendorProfile?.phone || '',
            whatsapp: vendor.vendorProfile?.whatsapp || '',
            instagram: vendor.vendorProfile?.instagram || '',
            website: vendor.vendorProfile?.website || '',
            governorate: vendor.vendorProfile?.governorate || '',
            city: vendor.vendorProfile?.city || '',
            address: vendor.vendorProfile?.address || '',
            membershipTier: vendor.membershipTier,
            memberSince: vendor.createdAt,
          },
          products: products.map((p) => ({
            id: p._id,
            ...p,
            _id: undefined,
            vendorName: vendor.name,
          })),
        })
      )
    }

    // ---- GET /vendor/profile (my profile, for editing) ----
    if (route === '/vendor/profile' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (user?.role !== 'VENDOR' && user?.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
        )
      }
      return handleCORS(
        NextResponse.json({
          profile: {
            id: user._id,
            name: user.name,
            email: user.email,
            slug: user.vendorProfile?.slug || '',
            businessName: user.vendorProfile?.businessName || user.name,
            tagline: user.vendorProfile?.tagline || '',
            bio: user.vendorProfile?.bio || '',
            banner: user.vendorProfile?.banner || '',
            logo: user.vendorProfile?.logo || '',
            phone: user.vendorProfile?.phone || '',
            whatsapp: user.vendorProfile?.whatsapp || '',
            instagram: user.vendorProfile?.instagram || '',
            website: user.vendorProfile?.website || '',
            governorate: user.vendorProfile?.governorate || '',
            city: user.vendorProfile?.city || '',
            address: user.vendorProfile?.address || '',
          },
        })
      )
    }

    // ---- PUT /vendor/profile (edit my vendor profile) ----
    if (route === '/vendor/profile' && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id)
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const prof = user.vendorProfile || {}

      // Text fields with length caps
      const strFields = {
        businessName: 80,
        tagline: 160,
        bio: 3000,
        phone: 30,
        whatsapp: 30,
        instagram: 80,
        website: 200,
        governorate: 40,
        city: 60,
        address: 300,
      }
      for (const [key, cap] of Object.entries(strFields)) {
        if (body[key] !== undefined) {
          prof[key] = String(body[key] || '').trim().slice(0, cap)
        }
      }
      if (prof.businessName && prof.businessName.length < 2) {
        return handleCORS(
          NextResponse.json({ error: 'اسم المتجر قصير جداً' }, { status: 400 })
        )
      }

      // Image fields (base64 data URL)
      for (const f of ['banner', 'logo']) {
        if (body[f] !== undefined) {
          const v = body[f]
          if (v === '' || v === null) {
            prof[f] = ''
          } else if (
            typeof v === 'string' &&
            /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) &&
            v.length <= 3_000_000
          ) {
            prof[f] = v
          } else {
            return handleCORS(
              NextResponse.json(
                { error: 'صيغة/حجم الصورة غير مدعوم' },
                { status: 400 }
              )
            )
          }
        }
      }

      // Custom slug (optional). Validate uniqueness if provided.
      if (body.slug !== undefined) {
        const desired = slugify(body.slug)
        if (!desired) {
          return handleCORS(
            NextResponse.json(
              { error: 'الرابط غير صالح' },
              { status: 400 }
            )
          )
        }
        if (desired.length < 3 || desired.length > 60) {
          return handleCORS(
            NextResponse.json(
              { error: 'الرابط يجب أن يكون بين 3 و 60 حرفاً' },
              { status: 400 }
            )
          )
        }
        if (desired !== prof.slug) {
          const collision = await User.findOne({
            'vendorProfile.slug': desired,
            _id: { $ne: user._id },
          }).lean()
          if (collision) {
            return handleCORS(
              NextResponse.json(
                { error: 'هذا الرابط مستخدم، جرّب اسماً آخر' },
                { status: 409 }
              )
            )
          }
          prof.slug = desired
        }
      }

      // If somehow slug is empty, synthesize one
      if (!prof.slug) {
        prof.slug = await uniqueVendorSlug(
          User,
          prof.businessName || user.name,
          user._id
        )
      }

      user.vendorProfile = prof
      user.updatedAt = new Date()
      await user.save()
      return handleCORS(
        NextResponse.json({
          success: true,
          profile: { ...prof, id: user._id, name: user.name, email: user.email },
        })
      )
    }


    // ---- Coupons + Admin CRUD (see /lib/api/coupons.js) ----
    if (route === '/coupons/validate' && method === 'POST') {
      return handleCouponValidate(request)
    }
    if (route === '/admin/coupons' && method === 'GET') {
      return handleAdminCouponsList()
    }
    if (route === '/admin/coupons' && method === 'POST') {
      return handleAdminCouponCreate(request)
    }
    if (adminCouponActionMatch && method === 'PATCH') {
      return handleAdminCouponUpdate(request, adminCouponActionMatch[1])
    }
    if (adminCouponActionMatch && method === 'DELETE') {
      return handleAdminCouponDelete(adminCouponActionMatch[1])
    }


    /* ============================================================
       MARKETPLACE — ORDERS
       ============================================================ */
    // ---- POST /orders (create order from cart items) ----
    if (route === '/orders' && method === 'POST') {
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
          return handleCORS(
            NextResponse.json(
              { error: 'للشراء كضيف، الاسم والبريد الإلكتروني مطلوبان' },
              { status: 400 }
            )
          )
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail)) {
          return handleCORS(
            NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
          )
        }
        // Find existing user by email; if exists and has a password, block (they should login)
        let existingUser = await User.findOne({ email: gEmail })
        if (existingUser && existingUser.password && !existingUser.isGuest) {
          return handleCORS(
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
        return handleCORS(
          NextResponse.json({ error: 'السلة فارغة' }, { status: 400 })
        )
      }
      const shipping = body?.shippingAddress || {}
      if (!shipping?.name || !shipping?.phone || !shipping?.addressLine) {
        return handleCORS(
          NextResponse.json(
            { error: 'عنوان الشحن (الاسم، الهاتف، العنوان) مطلوب' },
            { status: 400 }
          )
        )
      }

      // Fetch authoritative product prices + stocks server-side
      const ids = cartItems.map((it) => String(it.productId))
      const products = await Product.find({
        _id: { $in: ids },
        isActive: true,
      })
      if (products.length !== ids.length) {
        return handleCORS(
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
          return handleCORS(
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
            return handleCORS(
              NextResponse.json(
                { error: `يرجى اختيار خيار (متغير) للمنتج "${p.nameAr}"` },
                { status: 400 }
              )
            )
          }
          const variant = findVariant(p, vid)
          if (!variant) {
            return handleCORS(
              NextResponse.json(
                { error: `الخيار المحدد للمنتج "${p.nameAr}" غير موجود` },
                { status: 400 }
              )
            )
          }
          if (variant.stock < qty) {
            return handleCORS(
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
          return handleCORS(
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
      const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(3)
      const commissionAmount = +(subtotal * (COMMISSION_PERCENT / 100)).toFixed(3)
      const afterTier = +(subtotal - discountAmount).toFixed(3)

      // ----- Coupon (optional) -----
      const couponCodeRaw = String(body?.couponCode || '').trim()
      let couponDiscount = 0
      let couponRef = null
      if (couponCodeRaw) {
        const cv = await validateCouponForUser(couponCodeRaw, session.user.id, afterTier)
        if (!cv.ok) {
          return handleCORS(
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
        return handleCORS(
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
          return handleCORS(
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
        return handleCORS(
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

      return handleCORS(
        NextResponse.json({
          success: true,
          order: { id: order._id, ...order.toObject(), _id: undefined },
        })
      )
    }

    // ==================================================================
    // THAWANI PAYMENT — verify + webhook endpoints
    // ==================================================================

    // ---- POST /orders/verify  (auth) —— called from success page ----
    if (route === '/orders/verify' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const body = await request.json().catch(() => ({}))
      const sessionId = String(body?.sessionId || '')
      const orderId = String(body?.orderId || '')
      if (!sessionId && !orderId) {
        return handleCORS(
          NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
        )
      }
      const order = await Order.findOne(
        sessionId
          ? { thawaniSessionId: sessionId }
          : { _id: orderId }
      )
      if (!order) {
        return handleCORS(
          NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
        )
      }
      // Security: only the buyer can verify their own order
      if (String(order.buyerId) !== String(session.user.id)) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح بالوصول لهذا الطلب' }, { status: 403 })
        )
      }

      // Query Thawani for authoritative status
      if (order.thawaniSessionId) {
        const t = await thawaniGetSession(order.thawaniSessionId)
        if (t.ok) {
          if (t.paymentStatus === 'paid' && order.status !== 'PAID') {
            const buyer = await User.findById(order.buyerId).lean()
            await finalizeOrderPayment(order, buyer)
          } else if (t.paymentStatus === 'cancelled' && order.status === 'PENDING') {
            order.status = 'CANCELLED'
            order.paymentStatus = 'FAILED'
            order.updatedAt = new Date()
            await order.save()
          }
        }
      }
      const fresh = await Order.findById(order._id).lean()
      return handleCORS(
        NextResponse.json({
          success: true,
          paid: fresh.status === 'PAID',
          status: fresh.status,
          paymentStatus: fresh.paymentStatus,
          order: {
            id: fresh._id,
            totalPaid: fresh.totalPaid,
            couponCode: fresh.couponCode,
            shippingFee: fresh.shippingFee,
            items: fresh.items,
            invoice: fresh.thawaniInvoice || '',
            createdAt: fresh.createdAt,
          },
        })
      )
    }

    // ---- POST /webhooks/thawani (public — HMAC verified) ----
    if (route === '/webhooks/thawani' && method === 'POST') {
      const rawBody = await request.text()
      const signature = request.headers.get('thawani-signature') || ''
      const timestamp = request.headers.get('thawani-timestamp') || ''
      // If webhook secret not configured, reject with 501 (not 200) so Thawani retries later
      if (!process.env.THAWANI_WEBHOOK_SECRET) {
        console.warn('[thawani webhook] WEBHOOK_SECRET not configured')
        return handleCORS(
          NextResponse.json({ error: 'webhook secret not configured' }, { status: 501 })
        )
      }
      if (!thawaniVerifySignature(rawBody, timestamp, signature)) {
        console.warn('[thawani webhook] invalid signature')
        return handleCORS(
          NextResponse.json({ error: 'invalid signature' }, { status: 401 })
        )
      }
      let payload
      try { payload = JSON.parse(rawBody) } catch { payload = null }
      if (!payload) {
        return handleCORS(NextResponse.json({ error: 'bad payload' }, { status: 400 }))
      }
      const eventType = payload.event_type || ''
      const data = payload.data || {}
      await connectDB()
      try {
        if (eventType === 'checkout.completed' || eventType === 'payment.succeeded') {
          // Identify the order via session_id (checkout) or client_reference_id (payment)
          const sid = data.session_id
          const clientRef = data.client_reference_id
          const invoiceId = data.checkout_invoice || data.invoice
          const query = sid
            ? { thawaniSessionId: sid }
            : clientRef
              ? { _id: clientRef }
              : invoiceId
                ? { thawaniInvoice: String(invoiceId) }
                : null
          if (query) {
            const order = await Order.findOne(query)
            if (order && order.status !== 'PAID') {
              const buyer = await User.findById(order.buyerId).lean()
              if (data.payment_id) order.paymentId = data.payment_id
              await order.save()
              await finalizeOrderPayment(order, buyer)
            }
          }
        } else if (eventType === 'payment.failed') {
          const sid = data.session_id
          const invoiceId = data.checkout_invoice || data.invoice
          const query = sid
            ? { thawaniSessionId: sid }
            : invoiceId
              ? { thawaniInvoice: String(invoiceId) }
              : null
          if (query) {
            const order = await Order.findOne(query)
            if (order && order.status === 'PENDING') {
              order.status = 'FAILED'
              order.paymentStatus = 'FAILED'
              order.updatedAt = new Date()
              await order.save()
            }
          }
        }
      } catch (e) {
        console.error('[thawani webhook] processing error', e)
      }
      return handleCORS(NextResponse.json({ received: true }))
    }


    // ---- GET /orders (my orders as buyer) ----
    if (route === '/orders' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const orders = await Order.find({ buyerId: session.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
      return handleCORS(
        NextResponse.json({
          orders: orders.map((o) => ({ id: o._id, ...o, _id: undefined })),
        })
      )
    }

    // ---- GET /orders/:id (buyer or vendor of any item or admin) ----
    if (orderDetailMatch && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const order = await Order.findById(orderDetailMatch[1]).lean()
      if (!order) {
        return handleCORS(
          NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
        )
      }
      const uid = session.user.id
      const isBuyer = order.buyerId === uid
      const isVendor = (order.items || []).some((it) => it.vendorId === uid)
      const isAdmin = session.user.role === 'ADMIN'
      if (!isBuyer && !isVendor && !isAdmin) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكنك عرض هذا الطلب' }, { status: 403 })
        )
      }
      // If vendor, only expose their own items for privacy
      let items = order.items
      if (isVendor && !isAdmin && !isBuyer) {
        items = items.filter((it) => it.vendorId === uid)
      }
      return handleCORS(
        NextResponse.json({
          order: { id: order._id, ...order, _id: undefined, items },
        })
      )
    }

    // ---- GET /vendor/orders (orders containing items from this vendor) ----
    if (route === '/vendor/orders' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
        )
      }
      const orders = await Order.find({
        'items.vendorId': session.user.id,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      const buyerIds = Array.from(new Set(orders.map((o) => o.buyerId)))
      const buyers = await User.find({ _id: { $in: buyerIds } })
        .select({ _id: 1, name: 1, email: 1 })
        .lean()
      const buyerMap = Object.fromEntries(
        buyers.map((b) => [b._id, { id: b._id, name: b.name, email: b.email }])
      )
      // For each order, only return vendor's own items
      const enriched = orders.map((o) => {
        const vItems = (o.items || []).filter(
          (it) => it.vendorId === session.user.id
        )
        const vSubtotal = vItems.reduce((s, it) => s + it.lineSubtotal, 0)
        const vCommission = +(vSubtotal * (COMMISSION_PERCENT / 100)).toFixed(3)
        const vNet = +(vSubtotal - vCommission).toFixed(3)
        return {
          id: o._id,
          createdAt: o.createdAt,
          status: o.status,
          paymentStatus: o.paymentStatus,
          shippingAddress: o.shippingAddress,
          buyer: buyerMap[o.buyerId] || null,
          items: vItems,
          vendorSubtotal: +vSubtotal.toFixed(3),
          vendorCommission: vCommission,
          vendorNet: vNet,
        }
      })
      // Aggregate earnings
      const totalSales = enriched.reduce(
        (s, o) => s + (o.paymentStatus === 'PAID' ? o.vendorSubtotal : 0),
        0
      )
      const totalCommission = enriched.reduce(
        (s, o) => s + (o.paymentStatus === 'PAID' ? o.vendorCommission : 0),
        0
      )
      const totalNet = enriched.reduce(
        (s, o) => s + (o.paymentStatus === 'PAID' ? o.vendorNet : 0),
        0
      )
      return handleCORS(
        NextResponse.json({
          orders: enriched,
          earnings: {
            totalSales: +totalSales.toFixed(3),
            totalCommission: +totalCommission.toFixed(3),
            totalNet: +totalNet.toFixed(3),
            commissionPercent: COMMISSION_PERCENT,
            orderCount: enriched.length,
          },
        })
      )
    }

    // ---- PATCH /vendor/orders/:id/status (vendor updates their shipment status) ----
    if (orderStatusMatch && method === 'PATCH') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
        )
      }
      const order = await Order.findById(orderStatusMatch[1])
      if (!order) {
        return handleCORS(
          NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
        )
      }
      const hasItems = (order.items || []).some(
        (it) => it.vendorId === session.user.id
      )
      if (!hasItems && user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json(
            { error: 'لا يمكنك تعديل حالة هذا الطلب' },
            { status: 403 }
          )
        )
      }
      const body = await request.json().catch(() => ({}))
      const newStatus = String(body?.status || '').toUpperCase()
      const allowed = ['SHIPPED', 'DELIVERED', 'CANCELLED']
      if (!allowed.includes(newStatus)) {
        return handleCORS(
          NextResponse.json(
            { error: 'الحالة غير صحيحة' },
            { status: 400 }
          )
        )
      }
      // Enforce valid transitions
      const valid = {
        PAID: ['SHIPPED', 'CANCELLED'],
        SHIPPED: ['DELIVERED', 'CANCELLED'],
        DELIVERED: [],
        CANCELLED: [],
      }
      const currentAllowed = valid[order.status] || []
      if (!currentAllowed.includes(newStatus)) {
        return handleCORS(
          NextResponse.json(
            { error: `لا يمكن الانتقال من ${order.status} إلى ${newStatus}` },
            { status: 400 }
          )
        )
      }
      const trackingNumber = String(body?.trackingNumber || '').trim().slice(0, 80)
      const carrier = String(body?.carrier || '').trim().slice(0, 80)
      const note = String(body?.note || '').trim().slice(0, 500)

      order.status = newStatus
      order.updatedAt = new Date()
      if (trackingNumber) order.trackingNumber = trackingNumber
      if (carrier) order.carrier = carrier
      order.statusHistory = [
        ...(order.statusHistory || []),
        {
          status: newStatus,
          changedAt: new Date(),
          changedBy: session.user.id,
          actorName: user.name || 'البائع',
          note,
        },
      ]
      await order.save()

      // Fire-and-forget email on SHIPPED / DELIVERED / CANCELLED
      ;(async () => {
        try {
          const buyer = await User.findById(order.buyerId).lean()
          if (buyer?.email) {
            sendOrderStatusUpdateEmail({
              to: buyer.email,
              name: buyer.name,
              order: { id: order._id },
              newStatus,
              trackingNumber,
              carrier,
              note,
            }).catch((e) => console.error('[email] status update failed', e))
          }
        } catch (e) {
          console.error('[order status] email block failed', e)
        }
      })()

      return handleCORS(
        NextResponse.json({
          success: true,
          order: { id: order._id, ...order.toObject(), _id: undefined },
        })
      )
    }

    return handleCORS(
      NextResponse.json({ error: `Route ${route} not found` }, { status: 404 })
    )
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(
      NextResponse.json(
        { error: 'خطأ داخلي في الخادم' },
        { status: 500 }
      )
    )
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
