import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
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
