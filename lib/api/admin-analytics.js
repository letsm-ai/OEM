import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  User,
  Membership,
  Appointment,
  Company,
  Expert,
} from '@/lib/models'

/**
 * GET /admin/analytics
 * Returns dashboard KPIs + last-30-day and last-12-month time series for
 * signups, memberships, revenue, plus pending approvals and top experts.
 * Admin only.
 */
export async function handleAdminAnalytics() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
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
      {
        $match: {
          $or: [
            { paymentStatus: 'PAID' },
            // Fallback: any membership where money was actually recorded and
            // status was not explicitly marked as FAILED. Guards against legacy
            // rows where paymentStatus may be missing / mis-cased in production.
            { amountPaid: { $gt: 0 }, paymentStatus: { $nin: ['FAILED'] } },
          ],
        },
      },
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
    // Monthly membership revenue (last 12 months) — same defensive filter as topline
    Membership.aggregate([
      {
        $match: {
          $or: [
            { paymentStatus: 'PAID' },
            { amountPaid: { $gt: 0 }, paymentStatus: { $nin: ['FAILED'] } },
          ],
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

  return (
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
        // Diagnostic breakdown by ALL statuses — helps admin understand why
        // totalRevenue may look wrong in production. Computed only when the
        // main total is 0 to avoid extra work on healthy dashboards.
        diagnostic:
          membershipsSold === 0
            ? await Membership.aggregate([
                {
                  $group: {
                    _id: '$paymentStatus',
                    count: { $sum: 1 },
                    revenue: { $sum: '$amountPaid' },
                  },
                },
              ]).then((rows) =>
                rows.map((r) => ({
                  status: r._id || 'UNKNOWN',
                  count: r.count,
                  revenue: +(r.revenue || 0).toFixed(3),
                }))
              )
            : undefined,
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
