/**
 * Admin: users management + approvals summary.
 *   GET   /admin/users
 *   PATCH /admin/users/:id
 *   GET   /admin/approvals/summary
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  User,
  Company,
  Expert,
  VendorApplication,
  PayoutRequest,
} from '@/lib/models'
import { json, err, requireRole } from './_helpers'

export async function handleAdminUsersList(request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const url = new URL(request.url)
  const roleQ = url.searchParams.get('role') || ''
  const tier = url.searchParams.get('tier') || ''
  const suspended = url.searchParams.get('suspended') || ''
  const search = (url.searchParams.get('search') || '').trim()
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1),
    100
  )
  const q = { isGuest: { $ne: true } }
  if (roleQ) q.role = roleQ
  if (tier) q.membershipTier = tier
  if (suspended === '1') q.isSuspended = true
  else if (suspended === '0') q.isSuspended = { $ne: true }
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    q.$or = [{ name: rx }, { email: rx }, { phone: rx }]
  }
  const [total, users, totals] = await Promise.all([
    User.countDocuments(q),
    User.find(q)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.aggregate([
      { $match: { isGuest: { $ne: true } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'ADMIN'] }, 1, 0] } },
          members: { $sum: { $cond: [{ $eq: ['$role', 'MEMBER'] }, 1, 0] } },
          vendors: { $sum: { $cond: [{ $eq: ['$role', 'VENDOR'] }, 1, 0] } },
          experts: { $sum: { $cond: [{ $eq: ['$role', 'EXPERT'] }, 1, 0] } },
          suspended: { $sum: { $cond: ['$isSuspended', 1, 0] } },
        },
      },
    ]),
  ])
  return json({
    users: users.map((u) => ({ id: u._id, ...u, _id: undefined })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    totals: totals[0] || {
      total: 0,
      admins: 0,
      members: 0,
      vendors: 0,
      experts: 0,
      suspended: 0,
    },
  })
}

export async function handleAdminUserPatch(targetId, request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const target = await User.findById(targetId)
  if (!target) return err('المستخدم غير موجود', 404)
  if (
    String(target._id) === String(session.user.id) &&
    (body.action === 'suspend' || body.role)
  ) {
    return err('لا يمكنك تعديل حسابك الإداري', 400)
  }
  const update = {}
  if (body.role && ['ADMIN', 'MEMBER', 'VENDOR', 'EXPERT'].includes(body.role)) {
    update.role = body.role
  }
  if (
    body.membershipTier &&
    ['FREE', 'BASIC', 'GOLD', 'PLATINUM'].includes(body.membershipTier)
  ) {
    update.membershipTier = body.membershipTier
  }
  if (body.action === 'suspend') {
    update.isSuspended = true
    update.suspendedReason = String(body.reason || '').slice(0, 300)
    update.suspendedAt = new Date()
  } else if (body.action === 'activate') {
    update.isSuspended = false
    update.suspendedReason = ''
    update.suspendedAt = null
  }
  if (Object.keys(update).length === 0) return err('لا توجد تغييرات', 400)
  const updated = await User.findByIdAndUpdate(
    targetId,
    { $set: update },
    { new: true }
  )
    .select('-password')
    .lean()
  return json({
    user: { id: updated._id, ...updated, _id: undefined },
    message: 'تم تحديث المستخدم بنجاح',
  })
}

export async function handleAdminApprovalsSummary() {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const [pendingCompanies, pendingExperts, pendingVendorApps, pendingPayouts] =
    await Promise.all([
      Company.countDocuments({ status: 'PENDING' }),
      Expert.countDocuments({ status: 'PENDING' }),
      VendorApplication ? VendorApplication.countDocuments({ status: 'PENDING' }) : 0,
      PayoutRequest ? PayoutRequest.countDocuments({ status: 'PENDING' }) : 0,
    ])
  return json({
    companies: pendingCompanies,
    experts: pendingExperts,
    vendors: pendingVendorApps,
    payouts: pendingPayouts,
    total: pendingCompanies + pendingExperts + pendingVendorApps + pendingPayouts,
  })
}
