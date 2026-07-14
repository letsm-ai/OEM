import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import mongoose from 'mongoose'
import {
  User,
  Product,
  Order,
  Company,
  Expert,
  Membership,
  Appointment,
  VendorApplication,
  ProductReview,
  Wishlist,
  Cart,
  CartItem,
  CouponRedemption,
  StockMovement,
  Promotion,
  PayoutRequest,
  Availability,
  PasswordResetToken,
  EmailOptOut,
  EmailBroadcast,
  BroadcastTemplate,
} from '@/lib/models'

/**
 * Regex matching test / fake email domains commonly created during automated
 * testing. Includes RFC-2606 reserved TLDs (.test / .example / .invalid /
 * .localhost) as well as common throwaway domains used by our test suite
 * (@x.com, @test.*, @example.*).
 */
const TEST_EMAIL_RX =
  /(@x\.com$)|(@test\.(com|local|org)$)|(@.*\.test$)|(@example\.(com|org|local|net)$)|(@.*\.example\.(com|org|net)$)|(@localhost$)|(@.*\.localhost$)|(@resend-test\.)/i

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: 'UNAUTHORIZED', status: 401 }
  if (session.user.role !== 'ADMIN') return { error: 'FORBIDDEN', status: 403 }
  return { session }
}

/**
 * GET /admin/cleanup/scan
 * Returns a preview of every user with a test-looking email + counts of the
 * related documents that would be deleted in a cascade cleanup. NEVER writes.
 */
export async function handleCleanupScan() {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const users = await User.find({ email: { $regex: TEST_EMAIL_RX } })
    .select('_id email name role membershipTier createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const userIds = users.map((u) => u._id)
  const emails = users.map((u) => u.email)

  const [
    products,
    orders,
    companies,
    experts,
    memberships,
    appointmentsByUser,
    vendorApps,
  ] = await Promise.all([
    Product.countDocuments({ vendorId: { $in: userIds } }),
    Order.countDocuments({ buyerId: { $in: userIds } }),
    Company.countDocuments({ ownerId: { $in: userIds } }),
    Expert.countDocuments({ userId: { $in: userIds } }),
    Membership.countDocuments({ userId: { $in: userIds } }),
    Appointment.countDocuments({ userId: { $in: userIds } }),
    VendorApplication.countDocuments({ userId: { $in: userIds } }),
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      id: u._id,
      email: u.email,
      name: u.name || '',
      role: u.role,
      tier: u.membershipTier || 'FREE',
      createdAt: u.createdAt,
    })),
    totals: {
      users: users.length,
      products,
      orders,
      companies,
      experts,
      memberships,
      appointments: appointmentsByUser,
      vendorApplications: vendorApps,
    },
  })
}

/**
 * POST /admin/cleanup/execute
 * Actually deletes every user matching the test regex along with all of their
 * dependent documents. Returns the counts deleted.
 * Body: { confirm: 'DELETE-TEST-DATA' } — safety guard against accidental hits.
 */
export async function handleCleanupExecute(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE-TEST-DATA') {
    return NextResponse.json(
      { error: 'MISSING_CONFIRM', message: 'يجب تأكيد الحذف بإرسال confirm=DELETE-TEST-DATA' },
      { status: 400 }
    )
  }

  await connectDB()
  const users = await User.find({ email: { $regex: TEST_EMAIL_RX } })
    .select('_id email')
    .lean()

  if (users.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'لا توجد بيانات تجريبية للحذف',
      deleted: { users: 0 },
    })
  }

  const userIds = users.map((u) => u._id)
  const emails = users.map((u) => u.email)

  // Discover related entities BEFORE cascade
  const [productIds, expertIds] = await Promise.all([
    Product.find({ vendorId: { $in: userIds } })
      .select('_id')
      .lean()
      .then((rows) => rows.map((r) => r._id)),
    Expert.find({ userId: { $in: userIds } })
      .select('_id')
      .lean()
      .then((rows) => rows.map((r) => r._id)),
  ])

  const deleted = {}
  const del = async (Model, filter, key) => {
    try {
      const r = await Model.deleteMany(filter)
      deleted[key] = r.deletedCount
    } catch (e) {
      // Model may not exist / collection empty — swallow to keep going
      deleted[key] = 0
    }
  }

  // Cascade children first — anything referencing users/products/experts
  await del(CartItem, { productId: { $in: productIds } }, 'cartItemsByProduct')
  await del(Cart, { userId: { $in: userIds } }, 'carts')
  await del(Wishlist, { userId: { $in: userIds } }, 'wishlists')
  await del(CouponRedemption, { userId: { $in: userIds } }, 'couponRedemptions')
  await del(ProductReview, { userId: { $in: userIds } }, 'reviewsByUser')
  await del(ProductReview, { productId: { $in: productIds } }, 'reviewsByProduct')
  await del(StockMovement, { productId: { $in: productIds } }, 'stockMovements')
  await del(Promotion, { productId: { $in: productIds } }, 'promotionsByProduct')
  await del(Promotion, { vendorId: { $in: userIds } }, 'promotionsByVendor')
  await del(Appointment, { userId: { $in: userIds } }, 'appointmentsByUser')
  await del(Appointment, { expertId: { $in: expertIds } }, 'appointmentsByExpert')
  await del(Availability, { expertId: { $in: expertIds } }, 'availabilities')
  await del(PayoutRequest, { vendorId: { $in: userIds } }, 'payoutRequests')
  await del(VendorApplication, { userId: { $in: userIds } }, 'vendorApplications')
  await del(Membership, { userId: { $in: userIds } }, 'memberships')
  await del(PasswordResetToken, { userId: { $in: userIds } }, 'passwordTokens')
  await del(EmailOptOut, { email: { $in: emails } }, 'emailOptOuts')
  await del(EmailBroadcast, { sentBy: { $in: userIds } }, 'broadcasts')
  await del(BroadcastTemplate, { createdBy: { $in: userIds } }, 'broadcastTemplates')

  // Entities owned by users
  await del(Product, { _id: { $in: productIds } }, 'products')
  await del(Order, { buyerId: { $in: userIds } }, 'orders')
  await del(Company, { ownerId: { $in: userIds } }, 'companies')
  await del(Expert, { _id: { $in: expertIds } }, 'experts')

  // Finally the users themselves
  await del(User, { _id: { $in: userIds } }, 'users')

  return NextResponse.json({
    success: true,
    message: `تم حذف ${deleted.users} مستخدم تجريبي مع كل بياناتهم المرتبطة`,
    deleted,
  })
}

/* -------------------------------------------------------------------------- */
/*                     INDIVIDUAL BROWSE + DELETE HANDLERS                    */
/* -------------------------------------------------------------------------- */

const ENTITY_TYPES = ['users', 'companies', 'experts', 'products']

function isValidObjectId(id) {
  // System uses UUID format (36 chars with dashes) not MongoDB ObjectId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && (uuidRegex.test(id) || mongoose.Types.ObjectId.isValid(id))
}

/**
 * GET /admin/cleanup/browse?type=users|companies|experts|products&q=&page=&limit=
 * Returns paginated list of ANY entity (not just test data) so the admin can
 * hand-pick items to delete. Includes reference counts to warn about heavy
 * cascades.
 */
export async function handleCleanupBrowse(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') || 'users').toLowerCase()
  const q = (searchParams.get('q') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  if (!ENTITY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'INVALID_TYPE', message: `type must be one of: ${ENTITY_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  await connectDB()

  // ---- Search filters per entity type ----
  let items = []
  let total = 0
  const rx = q ? new RegExp(escapeRegex(q), 'i') : null

  if (type === 'users') {
    const filter = rx
      ? { $or: [{ email: rx }, { name: rx }, { phone: rx }] }
      : {}
    total = await User.countDocuments(filter)
    const rows = await User.find(filter)
      .select('_id email name role membershipTier phone createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    // Attach counts for warning
    const userIds = rows.map((r) => r._id)
    const [productCounts, orderCounts, companyCounts, expertCounts, membershipCounts] =
      await Promise.all([
        Product.aggregate([{ $match: { vendorId: { $in: userIds } } }, { $group: { _id: '$vendorId', c: { $sum: 1 } } }]),
        Order.aggregate([{ $match: { buyerId: { $in: userIds } } }, { $group: { _id: '$buyerId', c: { $sum: 1 } } }]),
        Company.aggregate([{ $match: { ownerId: { $in: userIds } } }, { $group: { _id: '$ownerId', c: { $sum: 1 } } }]),
        Expert.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', c: { $sum: 1 } } }]),
        Membership.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', c: { $sum: 1 } } }]),
      ])
    const asMap = (arr) => Object.fromEntries(arr.map((x) => [String(x._id), x.c]))
    const pMap = asMap(productCounts)
    const oMap = asMap(orderCounts)
    const cMap = asMap(companyCounts)
    const eMap = asMap(expertCounts)
    const mMap = asMap(membershipCounts)
    items = rows.map((r) => ({
      id: String(r._id),
      email: r.email,
      name: r.name || '',
      role: r.role,
      tier: r.membershipTier || 'FREE',
      phone: r.phone || '',
      createdAt: r.createdAt,
      refs: {
        products: pMap[String(r._id)] || 0,
        orders: oMap[String(r._id)] || 0,
        companies: cMap[String(r._id)] || 0,
        expertProfile: eMap[String(r._id)] || 0,
        memberships: mMap[String(r._id)] || 0,
      },
      isSelf: String(r._id) === String(auth.session.user.id),
    }))
  } else if (type === 'companies') {
    const filter = rx ? { $or: [{ nameAr: rx }, { nameEn: rx }, { description: rx }] } : {}
    total = await Company.countDocuments(filter)
    const rows = await Company.find(filter)
      .select('_id nameAr nameEn sector location userId featured verified logo createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    items = rows.map((r) => ({
      id: String(r._id),
      nameAr: r.nameAr,
      nameEn: r.nameEn || '',
      sector: r.sector,
      governorate: r.location || '',
      ownerId: r.userId ? String(r.userId) : null,
      featured: !!r.featured,
      verified: !!r.verified,
      logo: r.logo || '',
      createdAt: r.createdAt,
    }))
  } else if (type === 'experts') {
    const filter = rx ? { $or: [{ specialty: rx }, { specialtyAr: rx }, { bio: rx }] } : {}
    total = await Expert.countDocuments(filter)
    const rows = await Expert.find(filter)
      .select('_id specialty specialtyAr userId featured photo hourlyRate createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    const expertIds = rows.map((r) => r._id)
    const userIds = rows.map((r) => r.userId).filter(Boolean)
    const [bookingCounts, users] = await Promise.all([
      Appointment.aggregate([
        { $match: { expertId: { $in: expertIds } } },
        { $group: { _id: '$expertId', c: { $sum: 1 } } },
      ]),
      User.find({ _id: { $in: userIds } }).select('_id name').lean(),
    ])
    const bMap = Object.fromEntries(bookingCounts.map((x) => [String(x._id), x.c]))
    const uMap = Object.fromEntries(users.map((u) => [String(u._id), u.name || '']))
    items = rows.map((r) => ({
      id: String(r._id),
      nameAr: uMap[String(r.userId)] || '',
      nameEn: '',
      specialty: r.specialtyAr || r.specialty || '',
      userId: r.userId ? String(r.userId) : null,
      featured: !!r.featured,
      photo: r.photo || '',
      hourlyRate: r.hourlyRate || 0,
      createdAt: r.createdAt,
      refs: { bookings: bMap[String(r._id)] || 0 },
    }))
  } else if (type === 'products') {
    const filter = rx ? { $or: [{ nameAr: rx }, { nameEn: rx }, { description: rx }] } : {}
    total = await Product.countDocuments(filter)
    const rows = await Product.find(filter)
      .select('_id nameAr nameEn price stock vendorId featured images status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    const productIds = rows.map((r) => r._id)
    const [orderCounts, reviewCounts] = await Promise.all([
      Order.aggregate([
        { $match: { 'items.productId': { $in: productIds } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': { $in: productIds } } },
        { $group: { _id: '$items.productId', c: { $sum: 1 } } },
      ]),
      ProductReview.aggregate([
        { $match: { productId: { $in: productIds } } },
        { $group: { _id: '$productId', c: { $sum: 1 } } },
      ]),
    ])
    const oMap = Object.fromEntries(orderCounts.map((x) => [String(x._id), x.c]))
    const rMap = Object.fromEntries(reviewCounts.map((x) => [String(x._id), x.c]))
    items = rows.map((r) => ({
      id: String(r._id),
      nameAr: r.nameAr,
      nameEn: r.nameEn || '',
      price: r.price || 0,
      stock: r.stock || 0,
      vendorId: r.vendorId ? String(r.vendorId) : null,
      featured: !!r.featured,
      status: r.status || 'ACTIVE',
      image: (r.images && r.images[0]) || '',
      createdAt: r.createdAt,
      refs: {
        orderedTimes: oMap[String(r._id)] || 0,
        reviews: rMap[String(r._id)] || 0,
      },
    }))
  }

  return NextResponse.json({
    type,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    items,
  })
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * DELETE /admin/cleanup/entity
 * Body: { type: 'users'|'companies'|'experts'|'products', id, confirm }
 * Deletes a single entity of the given type and cascades all its dependents.
 * `confirm` must equal 'DELETE-ENTITY' for extra safety.
 */
export async function handleCleanupDeleteEntity(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const { type, id, confirm } = body || {}

  if (confirm !== 'DELETE-ENTITY') {
    return NextResponse.json(
      { error: 'MISSING_CONFIRM', message: 'يجب تأكيد الحذف بإرسال confirm=DELETE-ENTITY' },
      { status: 400 }
    )
  }
  if (!ENTITY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'INVALID_TYPE', message: `type must be one of: ${ENTITY_TYPES.join(', ')}` },
      { status: 400 }
    )
  }
  if (!isValidObjectId(id)) {
    return NextResponse.json(
      { error: 'INVALID_ID', message: 'معرّف غير صحيح' },
      { status: 400 }
    )
  }
  // Never allow admin to delete themselves
  if (type === 'users' && String(id) === String(auth.session.user.id)) {
    return NextResponse.json(
      { error: 'CANNOT_DELETE_SELF', message: 'لا يمكنك حذف حسابك أثناء تسجيل الدخول' },
      { status: 400 }
    )
  }

  await connectDB()
  const deleted = {}
  const del = async (Model, filter, key) => {
    try {
      const r = await Model.deleteMany(filter)
      deleted[key] = r.deletedCount
    } catch (e) {
      deleted[key] = 0
    }
  }

  try {
    if (type === 'users') {
      // Full cascade for a single user
      const user = await User.findById(id).lean()
      if (!user) {
        return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      }
      if (user.role === 'ADMIN') {
        // Extra safety: forbid deleting another admin unless we're the last one
        const adminCount = await User.countDocuments({ role: 'ADMIN' })
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'LAST_ADMIN', message: 'لا يمكن حذف آخر مسؤول في النظام' },
            { status: 400 }
          )
        }
      }
      const productIds = await Product.find({ vendorId: id }).distinct('_id')
      const expertIds = await Expert.find({ userId: id }).distinct('_id')

      await del(CartItem, { productId: { $in: productIds } }, 'cartItemsByProduct')
      await del(Cart, { userId: id }, 'carts')
      await del(Wishlist, { userId: id }, 'wishlists')
      await del(CouponRedemption, { userId: id }, 'couponRedemptions')
      await del(ProductReview, { userId: id }, 'reviewsByUser')
      await del(ProductReview, { productId: { $in: productIds } }, 'reviewsByProduct')
      await del(StockMovement, { productId: { $in: productIds } }, 'stockMovements')
      await del(Promotion, { productId: { $in: productIds } }, 'promotionsByProduct')
      await del(Promotion, { vendorId: id }, 'promotionsByVendor')
      await del(Appointment, { userId: id }, 'appointmentsByUser')
      await del(Appointment, { expertId: { $in: expertIds } }, 'appointmentsByExpert')
      await del(Availability, { expertId: { $in: expertIds } }, 'availabilities')
      await del(PayoutRequest, { vendorId: id }, 'payoutRequests')
      await del(VendorApplication, { userId: id }, 'vendorApplications')
      await del(Membership, { userId: id }, 'memberships')
      await del(PasswordResetToken, { userId: id }, 'passwordTokens')
      await del(EmailOptOut, { email: user.email }, 'emailOptOuts')
      await del(Product, { _id: { $in: productIds } }, 'products')
      await del(Order, { buyerId: id }, 'orders')
      await del(Company, { ownerId: id }, 'companies')
      await del(Expert, { _id: { $in: expertIds } }, 'experts')
      await del(User, { _id: id }, 'users')

      return NextResponse.json({
        success: true,
        message: `تم حذف الحساب "${user.email}" مع كل بياناته المرتبطة`,
        deleted,
      })
    }

    if (type === 'companies') {
      const company = await Company.findById(id).lean()
      if (!company) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      await del(Company, { _id: id }, 'companies')
      return NextResponse.json({
        success: true,
        message: `تم حذف الشركة "${company.nameAr}"`,
        deleted,
      })
    }

    if (type === 'experts') {
      const expert = await Expert.findById(id).lean()
      if (!expert) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      await del(Appointment, { expertId: id }, 'appointments')
      await del(Availability, { expertId: id }, 'availabilities')
      await del(Expert, { _id: id }, 'experts')
      return NextResponse.json({
        success: true,
        message: `تم حذف ملف الخبير "${expert.nameAr}" مع حجوزاته`,
        deleted,
      })
    }

    if (type === 'products') {
      const product = await Product.findById(id).lean()
      if (!product) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      await del(CartItem, { productId: id }, 'cartItems')
      await del(ProductReview, { productId: id }, 'reviews')
      await del(StockMovement, { productId: id }, 'stockMovements')
      await del(Promotion, { productId: id }, 'promotions')
      await del(Product, { _id: id }, 'products')
      return NextResponse.json({
        success: true,
        message: `تم حذف المنتج "${product.nameAr}"`,
        deleted,
      })
    }
  } catch (e) {
    console.error('[cleanup] delete entity failed:', e?.message)
    return NextResponse.json(
      { error: 'INTERNAL', message: e?.message || 'حدث خطأ أثناء الحذف' },
      { status: 500 }
    )
  }

  return NextResponse.json({ error: 'UNHANDLED' }, { status: 500 })
}
