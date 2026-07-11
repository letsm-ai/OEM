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
// NOTE: membership handlers now imported directly by dedicated files under
//       /app/app/api/membership/**
// NOTE: company handlers now imported directly by dedicated files under
//       /app/app/api/companies/** and /app/app/api/admin/companies/**
import {
  handleAppointmentBook,
  handleAppointmentsList,
  handleAppointmentCancel,
  handleAppointmentReview,
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
  handleUnsubscribeGet,
  handleUnsubscribePost,
  handleAdminOptOutList,
  handleAdminOptOutExport,
  handleAdminOptOutDelete,
} from '@/lib/api/unsubscribe'
import {
  handleAdminSettingsGet,
  handleAdminSettingsPatch,
} from '@/lib/api/admin-settings'
// NOTE: broadcast + broadcast-templates handlers are now imported directly by their
// dedicated per-route files under /app/app/api/admin/broadcast/**. They no longer
// need to be dispatched from this catch-all router.
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
import { finalizeOrderPayment } from '@/lib/order-finalize'

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
// finalizeOrderPayment moved to /app/lib/order-finalize.js (imported above)

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
    // Split → /app/app/api/admin/push/broadcast/route.js  (POST)
    // Split → /app/app/api/admin/push/stats/route.js       (GET)

    // -------- Email unsubscribe (public) --------
    if (route === '/unsubscribe' && method === 'GET') {
      return handleUnsubscribeGet(request)
    }
    if (route === '/unsubscribe' && method === 'POST') {
      return handleCORS(await handleUnsubscribePost(request))
    }

    // -------- Admin: EmailOptOut management --------
    // Split into dedicated files:
    //   /admin/email-optouts/route.js           (GET)
    //   /admin/email-optouts/export/route.js    (GET, returns text/csv)
    //   /admin/email-optouts/[id]/route.js      (DELETE)

    // -------- Admin: Site Settings --------
    // Split → /app/app/api/admin/settings/route.js  (GET, PATCH)

    // -------- Admin: Broadcast / Bulk Email Campaigns --------
    // NOTE: These routes have been SPLIT into dedicated files:
    //   /app/app/api/admin/broadcast/preview/route.js
    //   /app/app/api/admin/broadcast/send/route.js
    //   /app/app/api/admin/broadcast/history/route.js
    //   /app/app/api/admin/broadcast/templates/route.js          (GET, POST)
    //   /app/app/api/admin/broadcast/templates/[id]/route.js     (PUT, PATCH, DELETE)
    // Next.js prefers the more-specific file-based routes over this catch-all,
    // so we intentionally do NOT re-dispatch them here (removed 2025-refactor).

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
    // Now split into dedicated files under /app/app/api/membership/**:
    //   /membership/subscribe/route.js       (POST)
    //   /membership/verify/route.js          (POST)
    //   /membership/history/route.js         (GET)
    //   /membership/discount/route.js        (POST)
    //   /membership/start-trial/route.js     (POST)
    //   /membership/trial-status/route.js    (GET)

    /* ============================================================
       COMPANIES  (SPLIT to /app/app/api/companies/** + /admin/companies/**)
       ============================================================ */
    // Now handled by dedicated route files:
    //   /api/companies/route.js                          (GET, POST)
    //   /api/companies/[id]/route.js                     (GET, PUT, DELETE)
    //   /api/my-companies/route.js                       (GET)
    //   /api/admin/companies/route.js                    (GET)
    //   /api/admin/companies/[id]/approve/route.js       (POST)
    //   /api/admin/companies/[id]/reject/route.js        (POST)

    /* ============================================================
       ADMIN
       ============================================================ */
    // ---- GET /admin/analytics (KPIs + time series for charts) ----
    // Split → /app/app/api/admin/analytics/route.js  (GET, uses admin-analytics.js handler)

    // ---- GET /admin/companies?status=PENDING ----
    // Split → /app/app/api/admin/companies/route.js  (GET)
    //         /app/app/api/admin/companies/[id]/approve/route.js
    //         /app/app/api/admin/companies/[id]/reject/route.js

    /* ============================================================
       EXPERTS & APPOINTMENTS
       ============================================================ */

    // ---- EXPERTS routes: SPLIT into dedicated files under /app/app/api/experts/** and /admin/experts/** ----
    // Non-expert helpers (appointments, products, etc.) still handled below.
    // Keep only the regex matchers still used by other route families (appointments, products, wishlist, coupons, orders).
    const expertAvailMatch = null
    const expertSlotsMatch = null
    const expertDetailMatch = null
    const adminExpApproveMatch = null
    const adminExpRejectMatch = null
    const apptCancelMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/cancel$/
    )
    const apptReviewMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/review$/
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

    // ---- EXPERTS routes have been SPLIT into dedicated files: ----
    //   /api/experts/route.js                          (GET)
    //   /api/experts/apply/route.js                    (POST)
    //   /api/experts/me/route.js                       (GET, PUT)
    //   /api/experts/me/earnings/route.js              (GET)
    //   /api/experts/me/availability/route.js          (PUT)
    //   /api/experts/[id]/route.js                     (GET)
    //   /api/experts/[id]/reviews/route.js             (GET)
    //   /api/experts/[id]/availability/route.js        (GET)
    //   /api/experts/[id]/slots/route.js               (GET)
    //   /api/admin/experts/route.js                    (GET)
    //   /api/admin/experts/[id]/approve/route.js       (POST)
    //   /api/admin/experts/[id]/reject/route.js        (POST)

    // ---- APPOINTMENTS: SPLIT to /app/app/api/appointments/** ----
    //   /appointments/route.js                 (GET, POST)
    //   /appointments/[id]/cancel/route.js     (POST)
    //   /appointments/[id]/review/route.js     (POST)

    // ---- Admin experts routes are now in dedicated files (see comment above) ----




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

    // ---- Admin vendor-applications SPLIT: ----
    //   /admin/vendor-applications/route.js                       (GET)
    //   /admin/vendor-applications/[id]/[action]/route.js         (POST approve/reject)

    /* ============================================================
       MARKETPLACE — PRODUCTS
       ============================================================ */
    // ---- GET /products (public list of active products) ----
    // ---- POST /products/ai-search (AI-powered semantic search) ----
    // ---- POST /products/ai-search: SPLIT to /app/app/api/products/ai-search/route.js ----


    // ---- GET /products/:id (public detail) ----

    // ---- Product Reviews: SPLIT into dedicated files ----
    //   /products/[id]/reviews/route.js            (GET, POST)
    //   /products/[id]/my-review-status/route.js   (GET)

    // ---- GET /products/:id/related (public — related products) ----

    // ---- Wishlist: SPLIT to /app/app/api/wishlist/** ----
    //   /wishlist/route.js         (GET)
    //   /wishlist/[id]/route.js    (POST, DELETE)


    /* ============================================================
       MARKETPLACE — CART SYNC (for abandoned-cart reminders)
       ============================================================ */
    // ---- Cart: SPLIT to /app/app/api/cart/route.js (GET, POST, DELETE) ----

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

    // ---- Admin payouts SPLIT: ----
    //   /admin/payouts/route.js                       (GET)
    //   /admin/payouts/[id]/[action]/route.js         (POST approve/reject/mark-paid)

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


    // ---- Coupons: SPLIT ----
    //   /coupons/validate/route.js         (POST)
    //   /admin/coupons/route.js            (GET, POST)
    //   /admin/coupons/[id]/route.js       (PATCH, DELETE)

    /* ============================================================
       ADMIN USER MANAGEMENT
       ============================================================ */
    // ---- GET /admin/users?role=&tier=&suspended=&search=&page=&limit= ----
    // ---- Admin users SPLIT: ----
    //   /admin/users/route.js         (GET list)
    //   /admin/users/[id]/route.js    (PATCH role/tier/status)

    /* ============================================================
       ADMIN APPROVALS — combined summary
       ============================================================ */
    // Split → /app/app/api/admin/approvals/summary/route.js  (GET)

    // ---- Admin coupons CRUD is now under dedicated files (see comment above) ----


    /* ============================================================
       MARKETPLACE — ORDERS
       ============================================================ */
    // ---- POST /orders (create order from cart items) ----
    // /orders/route.js  →  GET (buyer list) + POST (checkout)  handlers in /lib/api/orders-read.js + orders-create.js

    // ==================================================================
    // THAWANI PAYMENT — verify + webhook endpoints
    // ==================================================================

    // ---- POST /orders/verify  (auth) —— called from success page ----

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
          const sid = data.session_id
          const clientRef = data.client_reference_id
          const metadata = data.metadata || {}
          const isMembership =
            metadata.kind === 'membership' ||
            String(clientRef || '').startsWith('mem_')

          // -------- Membership activation --------
          if (isMembership) {
            const memId =
              metadata.membership_id ||
              String(clientRef || '').replace(/^mem_/, '')
            const mem =
              (memId && (await Membership.findById(memId))) ||
              (sid && (await Membership.findOne({ thawaniSessionId: sid })))
            if (mem && mem.paymentStatus !== 'PAID') {
              const meta = TIER_META[mem.tier]
              const user = await User.findByIdAndUpdate(
                mem.userId,
                { membershipTier: mem.tier, membershipExpiry: mem.endDate },
                { new: true }
              ).lean()
              mem.paymentStatus = 'PAID'
              if (data.payment_id) mem.paymentId = data.payment_id
              await mem.save()
              if (user && meta) {
                sendSubscriptionEmail({
                  to: user.email,
                  name: user.name,
                  tierAr: meta.nameAr,
                  amount: meta.price,
                  expiryFormatted: formatArabicDate(mem.endDate),
                }).catch((e) =>
                  console.error('subscription email failed:', e)
                )
              }
            }
          } else {
            // -------- Order payment (existing behaviour) --------
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
          }
        } else if (eventType === 'payment.failed') {
          const sid = data.session_id
          const clientRef = data.client_reference_id
          const metadata = data.metadata || {}
          const isMembership =
            metadata.kind === 'membership' ||
            String(clientRef || '').startsWith('mem_')

          if (isMembership) {
            const memId =
              metadata.membership_id ||
              String(clientRef || '').replace(/^mem_/, '')
            const mem = memId
              ? await Membership.findById(memId)
              : sid
                ? await Membership.findOne({ thawaniSessionId: sid })
                : null
            if (mem && mem.paymentStatus === 'PENDING') {
              mem.paymentStatus = 'FAILED'
              await mem.save()
            }
          } else {
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
        }
      } catch (e) {
        console.error('[thawani webhook] processing error', e)
      }
      return handleCORS(NextResponse.json({ received: true }))
    }


    // ---- GET /orders (my orders as buyer) ----

    // ---- GET /orders/:id (buyer or vendor of any item or admin) ----

    // ---- GET /vendor/orders (orders containing items from this vendor) ----

    // ---- PATCH /vendor/orders/:id/status (vendor updates their shipment status) ----

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
