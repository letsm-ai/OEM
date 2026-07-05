import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Membership, PasswordResetToken, Company, Expert, Availability, Appointment, VendorApplication, Product, ProductReview, Order, Coupon, CouponRedemption, Cart, StockMovement, Promotion, PayoutRequest } from '@/lib/models'

// ---- Extracted modular handlers ----
import {
  handleShippingQuote,
} from '@/lib/api/shipping'
import {
  handleMembershipSubscribe,
  handleMembershipHistory,
  handleMembershipDiscount,
} from '@/lib/api/membership'
import {
  handleCompaniesList,
  handleCompanyCreate,
  handleCompanyDetail,
  handleCompanyUpdate,
  handleCompanyDelete,
  handleMyCompanies,
  handleAdminCompaniesList,
  handleAdminCompanyApprove,
  handleAdminCompanyReject,
} from '@/lib/api/companies'
import {
  handleExpertsList,
  handleExpertApply,
  handleExpertMe,
  handleExpertMeUpdate,
  handleExpertAvailabilityUpdate,
  handleExpertReviews,
  handleExpertAvailabilityGet,
  handleExpertSlots,
  handleExpertDetail,
  handleAppointmentBook,
  handleAppointmentsList,
  handleAppointmentCancel,
  handleAppointmentReview,
  handleAdminExpertsList,
  handleAdminExpertApprove,
  handleAdminExpertReject,
} from '@/lib/api/experts'
import {
  handleVendorApplicationGet,
  handleVendorApply,
  handleAdminVendorApplicationsList,
  handleAdminVendorApplicationAction,
} from '@/lib/api/vendor-application'
import {
  handleVendorPayoutsList,
  handleVendorPayoutCreate,
  handleAdminPayoutsList,
  handleAdminPayoutAction,
} from '@/lib/api/payouts'
import {
  handleAdminUsersList,
  handleAdminUserPatch,
  handleAdminApprovalsSummary,
} from '@/lib/api/admin-users'
import {
  handleVendorsList,
  handleVendorStorefront,
  handleVendorProfileGet,
  handleVendorProfileUpdate,
} from '@/lib/api/vendor-profile'
import {
  handleCartUpsert,
  handleCartGet,
  handleCartClear,
  handleAbandonedCartCron,
} from '@/lib/api/cart'
import { handleVendorAnalytics } from '@/lib/api/vendor-analytics'
import {
  handleVendorPromotionsList,
  handleVendorPromotionCreate,
  handleVendorPromotionAction,
  handleProductPromotions,
} from '@/lib/api/promotions'
import {
  handleVendorInventory,
  handleProductsImport,
  handleProductsImportTemplate,
  handleStockMovements,
  handleStockAdjust,
} from '@/lib/api/inventory'
import {
  handleProductCreate,
  handleProductUpdate,
  handleProductDelete,
  handleVendorProductsList,
} from '@/lib/api/products-vendor'
import { sanitizeSocial } from '@/lib/social'
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
  handlePushPublicKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushBroadcast,
  handlePushStats,
} from '@/lib/api/push'
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
import { recordStockMovement, isLowStock, lowStockVariants } from '@/lib/inventory'
import { applyAllPromotions } from '@/lib/promotions'
import { computeVendorBalance, MIN_PAYOUT_AMOUNT } from '@/lib/payouts'
import { normalizeTags } from '@/lib/tags'
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

    // 1) Stock is already decremented at order creation time.
    //    finalizeOrderPayment is idempotent via paymentProcessedSideEffects,
    //    but we intentionally DO NOT re-deduct stock here because inline decrement
    //    on POST /orders already reserved it (both for COD and Thawani PENDING).
    //    Double-decrement bug was causing negative stock values on variants.

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

    // -------- Web Push (VAPID) --------
    if (route === '/push/public-key' && method === 'GET') {
      return handleCORS(await handlePushPublicKey())
    }
    if (route === '/push/subscribe' && method === 'POST') {
      return handleCORS(await handlePushSubscribe(request))
    }
    if (route === '/push/unsubscribe' && method === 'POST') {
      return handleCORS(await handlePushUnsubscribe(request))
    }
    if (route === '/admin/push/broadcast' && method === 'POST') {
      return handleCORS(await handlePushBroadcast(request))
    }
    if (route === '/admin/push/stats' && method === 'GET') {
      return handleCORS(await handlePushStats())
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

    // -------- MEMBERSHIP routes --------
    if (route === '/membership/subscribe' && method === 'POST') {
      return handleMembershipSubscribe(request)
    }
    if (route === '/membership/history' && method === 'GET') {
      return handleMembershipHistory()
    }
    if (route === '/membership/discount' && method === 'POST') {
      return handleMembershipDiscount(request)
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
      return handleCompaniesList(request)
    }

    // ---- POST /companies  (auth + BASIC+) ----
    if (route === '/companies' && method === 'POST') {
      return handleCompanyCreate(request)
    }

    // ---- GET /companies/:id ----
    if (companyDetailMatch && method === 'GET') {
      return handleCompanyDetail(companyDetailMatch[1])
    }

    // ---- PUT /companies/:id  (owner updates; resets to PENDING) ----
    if (companyDetailMatch && method === 'PUT') {
      return handleCompanyUpdate(companyDetailMatch[1], request)
    }

    // ---- DELETE /companies/:id  (owner or admin) ----
    if (companyDetailMatch && method === 'DELETE') {
      return handleCompanyDelete(companyDetailMatch[1])
    }

    // ---- GET /my-companies ----
    if (route === '/my-companies' && method === 'GET') {
      return handleMyCompanies()
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
      return handleAdminCompaniesList(request)
    }

    // ---- POST /admin/companies/:id/approve ----
    if (adminApproveMatch && method === 'POST') {
      return handleAdminCompanyApprove(adminApproveMatch[1])
    }

    // ---- POST /admin/companies/:id/reject ----
    if (adminRejectMatch && method === 'POST') {
      return handleAdminCompanyReject(adminRejectMatch[1], request)
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
      return handleExpertsList(request)
    }

    // ---- POST /experts/apply ----
    if (route === '/experts/apply' && method === 'POST') {
      return handleExpertApply(request)
    }

    // ---- GET /experts/me ----
    if (route === '/experts/me' && method === 'GET') {
      return handleExpertMe()
    }

    // ---- PUT /experts/me ----
    if (route === '/experts/me' && method === 'PUT') {
      return handleExpertMeUpdate(request)
    }

    // ---- PUT /experts/me/availability ----
    if (route === '/experts/me/availability' && method === 'PUT') {
      return handleExpertAvailabilityUpdate(request)
    }

    // ---- GET /experts/:id/reviews ----
    if (
      /^\/experts\/([A-Za-z0-9-]+)\/reviews$/.test(route) &&
      method === 'GET'
    ) {
      return handleExpertReviews(
        route.match(/^\/experts\/([A-Za-z0-9-]+)\/reviews$/)[1]
      )
    }

    // ---- GET /experts/:id/availability ----
    if (expertAvailMatch && method === 'GET') {
      return handleExpertAvailabilityGet(expertAvailMatch[1])
    }

    // ---- GET /experts/:id/slots ----
    if (expertSlotsMatch && method === 'GET') {
      return handleExpertSlots(expertSlotsMatch[1], request)
    }

    // ---- GET /experts/:id (public) ----
    if (expertDetailMatch && method === 'GET') {
      return handleExpertDetail(expertDetailMatch[1])
    }

    // ---- POST /appointments (book) — supports guest booking ----
    if (route === '/appointments' && method === 'POST') {
      return handleAppointmentBook(request)
    }

    // ---- GET /appointments ----
    if (route === '/appointments' && method === 'GET') {
      return handleAppointmentsList(request)
    }

    // ---- POST /appointments/:id/cancel ----
    if (apptCancelMatch && method === 'POST') {
      return handleAppointmentCancel(apptCancelMatch[1])
    }

    // ---- POST /appointments/:id/review ----
    if (apptReviewMatch && method === 'POST') {
      return handleAppointmentReview(apptReviewMatch[1], request)
    }

    // ---- GET /admin/experts ----
    if (route === '/admin/experts' && method === 'GET') {
      return handleAdminExpertsList(request)
    }

    // ---- POST /admin/experts/:id/approve ----
    if (adminExpApproveMatch && method === 'POST') {
      return handleAdminExpertApprove(adminExpApproveMatch[1])
    }

    // ---- POST /admin/experts/:id/reject ----
    if (adminExpRejectMatch && method === 'POST') {
      return handleAdminExpertReject(adminExpRejectMatch[1], request)
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
    // ---- GET /vendor/application ----
    if (route === '/vendor/application' && method === 'GET') {
      return handleVendorApplicationGet()
    }

    // ---- POST /vendor/apply ----
    if (route === '/vendor/apply' && method === 'POST') {
      return handleVendorApply(request)
    }

    // ---- GET /admin/vendor-applications?status= (admin) ----
    if (route === '/admin/vendor-applications' && method === 'GET') {
      return handleAdminVendorApplicationsList(request)
    }

    // ---- POST /admin/vendor-applications/:id/(approve|reject) (admin) ----
    if (adminVendorAppActionMatch && method === 'POST') {
      return handleAdminVendorApplicationAction(
        adminVendorAppActionMatch[1],
        adminVendorAppActionMatch[2],
        request
      )
    }

    /* ============================================================
       MARKETPLACE — PRODUCTS
       ============================================================ */
    // ---- GET /products (public list of active products) ----
    // ---- POST /products/ai-search (AI-powered semantic search) ----
    if (route === '/products/ai-search' && method === 'POST') {
      await connectDB()
      const body = await request.json().catch(() => ({}))
      const query = String(body?.query || '').trim()
      if (!query) {
        return handleCORS(NextResponse.json({ error: 'استعلام البحث فارغ' }, { status: 400 }))
      }
      if (query.length > 200) {
        return handleCORS(NextResponse.json({ error: 'الاستعلام طويل جداً (الحد الأقصى 200 حرف)' }, { status: 400 }))
      }

      // ---- In-memory cache (5 min TTL) on filter inference to save tokens ----
      const cacheKey = query.toLowerCase().replace(/\s+/g, ' ').trim()
      const now = Date.now()
      if (!global.__aiSearchCache) global.__aiSearchCache = new Map()
      const cache = global.__aiSearchCache
      // Evict expired entries to keep map small
      if (cache.size > 200) {
        for (const [k, v] of cache) {
          if (now - v.t > 5 * 60 * 1000) cache.delete(k)
          if (cache.size <= 100) break
        }
      }

      // ---- Build catalog context (real categories + popular tags) ----
      // Only categories that actually have active products
      const catsAgg = await Product.distinct('category', { isActive: true })
      const allowedCategories = (catsAgg || []).filter(Boolean)
      // Top 30 popular tags from active products
      const tagsAgg = await Product.aggregate([
        { $match: { isActive: true, tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ])
      const allowedTags = (tagsAgg || []).map((t) => String(t._id || '').toLowerCase()).filter(Boolean)

      let filters
      const cached = cache.get(cacheKey)
      if (cached && now - cached.t < 5 * 60 * 1000) {
        filters = cached.filters
      } else {
        // Spawn the python helper, pass JSON via stdin
        const { spawn } = await import('node:child_process')
        const result = await new Promise((resolve) => {
          const pyBin = '/root/.venv/bin/python3'
          const proc = spawn(pyBin, ['/app/lib/ai_search.py'], {
            env: { ...process.env, EMERGENT_LLM_KEY: process.env.EMERGENT_LLM_KEY || '' },
          })
          let stdout = ''
          let stderr = ''
          proc.stdout.on('data', (d) => { stdout += d.toString() })
          proc.stderr.on('data', (d) => { stderr += d.toString() })
          const timer = setTimeout(() => {
            try { proc.kill('SIGKILL') } catch (_) {}
            resolve({ ok: false, error: 'انتهت مهلة البحث الذكي' })
          }, 25000)
          proc.on('close', (code) => {
            clearTimeout(timer)
            if (code !== 0) {
              console.error('[ai-search] exit', code, 'stderr:', stderr.slice(0, 500))
              try {
                const j = JSON.parse(stdout || '{}')
                if (j?.error) return resolve({ ok: false, error: j.error })
              } catch (_) {}
              return resolve({ ok: false, error: 'فشل البحث الذكي' })
            }
            try {
              resolve({ ok: true, data: JSON.parse(stdout) })
            } catch (e) {
              resolve({ ok: false, error: 'استجابة غير صالحة' })
            }
          })
          proc.stdin.write(JSON.stringify({
            query,
            categories: allowedCategories,
            tags: allowedTags,
          }))
          proc.stdin.end()
        })
        if (!result.ok) {
          return handleCORS(NextResponse.json({ error: result.error }, { status: 500 }))
        }
        filters = result.data?.filters || {}
        cache.set(cacheKey, { filters, t: now })
      }

      // Build mongo query from filters
      const q = { isActive: true }
      if (filters.category) q.category = filters.category
      if (Array.isArray(filters.tags) && filters.tags.length > 0) {
        q.tags = { $in: filters.tags }
      }
      if (filters.search) {
        const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        q.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }, { tags: rx }]
      }
      const priceFilter = {}
      if (typeof filters.minPrice === 'number') priceFilter.$gte = filters.minPrice
      if (typeof filters.maxPrice === 'number') priceFilter.$lte = filters.maxPrice
      if (Object.keys(priceFilter).length > 0) q.price = priceFilter
      if (filters.minRating > 0) q.rating = { $gte: filters.minRating }

      const products = await Product.find(q)
        .sort({ rating: -1, salesCount: -1 })
        .limit(40)
        .lean()
      return handleCORS(
        NextResponse.json({
          query,
          filters,
          interpretation_ar: filters.interpretation_ar || '',
          cached: !!cached,
          products: products.map((p) => ({ id: p._id, ...p, _id: undefined })),
          count: products.length,
        })
      )
    }


    if (route === '/tags/popular' && method === 'GET') {
      await connectDB()
      const url = new URL(request.url)
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100)
      const agg = await Product.aggregate([
        { $match: { isActive: true, tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      return handleCORS(
        NextResponse.json({
          tags: agg.map((t) => ({ tag: t._id, count: t.count })),
        })
      )
    }

    if (route === '/products' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('search') || '').trim()
      const category = url.searchParams.get('category') || ''
      const subcategory = (url.searchParams.get('subcategory') || '').trim()
      const sort = (url.searchParams.get('sort') || 'newest').toLowerCase()
      const tagsParam = (url.searchParams.get('tags') || '').trim()
      const minPriceParam = url.searchParams.get('minPrice')
      const maxPriceParam = url.searchParams.get('maxPrice')
      const minRatingParam = url.searchParams.get('minRating')
      const freeShippingParam = url.searchParams.get('freeShipping') === '1'
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1),
        500
      )
      await connectDB()
      const query = { isActive: true }
      if (category && CATEGORY_KEYS.includes(category)) {
        query.category = category
      }
      if (subcategory) {
        query.subcategory = subcategory
      }
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }, { tags: rx }]
      }
      // Tag filter (comma separated → match ANY)
      if (tagsParam) {
        const list = tagsParam.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        if (list.length > 0) query.tags = { $in: list }
      }
      // Price range
      const minPrice = minPriceParam ? Number(minPriceParam) : null
      const maxPrice = maxPriceParam ? Number(maxPriceParam) : null
      if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        query.price = {}
        if (Number.isFinite(minPrice)) query.price.$gte = minPrice
        if (Number.isFinite(maxPrice)) query.price.$lte = maxPrice
      }
      // Min rating
      const minRating = minRatingParam ? Number(minRatingParam) : null
      if (Number.isFinite(minRating) && minRating > 0) {
        query.rating = { $gte: minRating }
      }
      // Free shipping hint — price >= FREE_SHIPPING_THRESHOLD
      if (freeShippingParam) {
        query.price = { ...(query.price || {}), $gte: FREE_SHIPPING_THRESHOLD }
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
      return handleCartUpsert(request)
    }

    // ---- GET /cart (auth) — fetch saved cart ----
    if (route === '/cart' && method === 'GET') {
      return handleCartGet()
    }

    // ---- DELETE /cart (auth) — clear cart (after order success) ----
    if (route === '/cart' && method === 'DELETE') {
      return handleCartClear()
    }

    /* ============================================================
       CRON — ABANDONED CART REMINDER EMAILS
       ============================================================ */
    // ---- POST /cron/abandoned-carts (requires X-CRON-KEY header OR ADMIN) ----
    if (route === '/cron/abandoned-carts' && method === 'POST') {
      return handleAbandonedCartCron(request)
    }




    // ---- POST /products (vendor only) ----
    if (route === '/products' && method === 'POST') {
      return handleProductCreate(request)
    }

    // ---- PUT /products/:id (owner or admin) ----
    if (productDetailMatch && method === 'PUT') {
      return handleProductUpdate(productDetailMatch[1], request)
    }

    // ---- DELETE /products/:id (owner or admin; hard delete if no orders, else soft) ----
    if (productDetailMatch && method === 'DELETE') {
      return handleProductDelete(productDetailMatch[1])
    }

    // ---- GET /vendor/products (my products) ----
    if (route === '/vendor/products' && method === 'GET') {
      return handleVendorProductsList()
    }

    // ---- GET /vendor/analytics (vendor KPIs + time series for charts) ----
    if (route === '/vendor/analytics' && method === 'GET') {
      return handleVendorAnalytics()
    }

    /* ============================================================
       PAYOUTS (نظام المدفوعات للبائع)
       ============================================================ */

    // ---- GET /vendor/payouts (balance + list of requests) ----
    if (route === '/vendor/payouts' && method === 'GET') {
      return handleVendorPayoutsList()
    }

    // ---- POST /vendor/payouts (vendor requests a payout) ----
    if (route === '/vendor/payouts' && method === 'POST') {
      return handleVendorPayoutCreate(request)
    }

    // ---- GET /admin/payouts (admin: all requests, filterable) ----
    if (route === '/admin/payouts' && method === 'GET') {
      return handleAdminPayoutsList(request)
    }

    // ---- POST /admin/payouts/:id/:action (admin approve/reject/mark-paid) ----
    const adminPayoutMatch = route.match(
      /^\/admin\/payouts\/([A-Za-z0-9-]+)\/(approve|reject|mark-paid)$/
    )
    if (adminPayoutMatch && method === 'POST') {
      return handleAdminPayoutAction(adminPayoutMatch[1], adminPayoutMatch[2], request)
    }

    /* ============================================================
       PROMOTIONS (عروض ترويجية)
       ============================================================ */
    // ---- GET /vendor/promotions (list vendor's promos) ----
    if (route === '/vendor/promotions' && method === 'GET') {
      return handleVendorPromotionsList()
    }

    // ---- POST /vendor/promotions (create) ----
    if (route === '/vendor/promotions' && method === 'POST') {
      return handleVendorPromotionCreate(request)
    }

    // ---- PUT/DELETE /vendor/promotions/:id ----
    const promotionMatch = route.match(/^\/vendor\/promotions\/([A-Za-z0-9-]+)$/)
    if (promotionMatch && (method === 'PUT' || method === 'DELETE')) {
      return handleVendorPromotionAction(promotionMatch[1], method, request)
    }

    // ---- GET /products/:id/promotions (public: promo badges for a product) ----
    const productPromosMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/promotions$/
    )
    if (productPromosMatch && method === 'GET') {
      return handleProductPromotions(productPromosMatch[1])
    }


    // ---- POST /vendor/products/import (CSV import) ----
    if (route === '/vendor/products/import' && method === 'POST') {
      return handleProductsImport(request)
    }

    // ---- GET /vendor/products/import/template (CSV template download) ----
    if (route === '/vendor/products/import/template' && method === 'GET') {
      return handleProductsImportTemplate()
    }

    // ---- GET /vendor/inventory ----
    if (route === '/vendor/inventory' && method === 'GET') {
      return handleVendorInventory(request)
    }

    // ---- GET /products/:id/stock/movements ----
    const stockMovementsMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/stock\/movements$/
    )
    if (stockMovementsMatch && method === 'GET') {
      return handleStockMovements(stockMovementsMatch[1])
    }

    // ---- POST /products/:id/stock/adjust ----
    const stockAdjustMatch = route.match(
      /^\/products\/([A-Za-z0-9-]+)\/stock\/adjust$/
    )
    if (stockAdjustMatch && method === 'POST') {
      return handleStockAdjust(stockAdjustMatch[1], request)
    }

    /* ============================================================
       VENDOR STOREFRONT (public)
       ============================================================ */
    // ---- GET /vendors (public list of approved vendors) ----
    if (route === '/vendors' && method === 'GET') {
      return handleVendorsList()
    }

    // ---- GET /vendors/:slug (public vendor storefront) ----
    if (vendorBySlugMatch && method === 'GET') {
      return handleVendorStorefront(vendorBySlugMatch[1])
    }

    // ---- GET /vendor/profile (my profile, for editing) ----
    if (route === '/vendor/profile' && method === 'GET') {
      return handleVendorProfileGet()
    }

    // ---- PUT /vendor/profile (edit my vendor profile) ----
    if (route === '/vendor/profile' && method === 'PUT') {
      return handleVendorProfileUpdate(request)
    }


    // ---- Coupons + Admin CRUD (see /lib/api/coupons.js) ----
    if (route === '/coupons/validate' && method === 'POST') {
      return handleCouponValidate(request)
    }

    /* ============================================================
       ADMIN USER MANAGEMENT
       ============================================================ */
    // ---- GET /admin/users?role=&tier=&suspended=&search=&page=&limit= ----
    if (route === '/admin/users' && method === 'GET') {
      return handleAdminUsersList(request)
    }

    // ---- PATCH /admin/users/:id  (change role, tier, or suspend/activate) ----
    const adminUserMatch = route.match(/^\/admin\/users\/([^/]+)$/)
    if (adminUserMatch && method === 'PATCH') {
      return handleAdminUserPatch(adminUserMatch[1], request)
    }

    /* ============================================================
       ADMIN APPROVALS — combined summary
       ============================================================ */
    if (route === '/admin/approvals/summary' && method === 'GET') {
      return handleAdminApprovalsSummary()
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
      const uniqueIds = [...new Set(ids)]
      const products = await Product.find({
        _id: { $in: uniqueIds },
        isActive: true,
      })
      if (products.length !== uniqueIds.length) {
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
