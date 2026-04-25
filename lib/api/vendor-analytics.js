/**
 * Vendor analytics — KPI dashboard with time series and aggregations.
 *   GET /vendor/analytics
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product, Order } from '@/lib/models'
import { COMMISSION_PERCENT } from '@/lib/store'
import { json, err, requireAuth } from './_helpers'

const REVENUE_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED']

export async function handleVendorAnalytics() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (!user || (user.role !== 'VENDOR' && user.role !== 'ADMIN')) {
    return err('صلاحيات بائع مطلوبة', 403)
  }

  const vendorId = session.user.id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth12 = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)
  )

  const [productsTotal, productsActive, productsLowStock] = await Promise.all([
    Product.countDocuments({ vendorId }),
    Product.countDocuments({ vendorId, isActive: true }),
    Product.countDocuments({ vendorId, isActive: true, stock: { $lte: 5 } }),
  ])

  const [
    kpiAgg,
    last30Agg,
    monthlyAgg,
    topProductsAgg,
    byCategoryAgg,
    statusAgg,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: REVENUE_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      {
        $group: {
          _id: '$_id',
          subtotal: { $sum: '$items.lineSubtotal' },
          units: { $sum: '$items.quantity' },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$subtotal' },
          totalUnits: { $sum: '$units' },
          totalOrders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      {
        $group: {
          _id: '$_id',
          subtotal: { $sum: '$items.lineSubtotal' },
          units: { $sum: '$items.quantity' },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$subtotal' },
          units: { $sum: '$units' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          status: { $in: REVENUE_STATUSES },
          createdAt: { $gte: startOfMonth12 },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      {
        $group: {
          _id: {
            orderId: '$_id',
            y: { $year: '$createdAt' },
            m: { $month: '$createdAt' },
          },
          subtotal: { $sum: '$items.lineSubtotal' },
          units: { $sum: '$items.quantity' },
        },
      },
      {
        $group: {
          _id: { y: '$_id.y', m: '$_id.m' },
          revenue: { $sum: '$subtotal' },
          orders: { $sum: 1 },
          units: { $sum: '$units' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { status: { $in: REVENUE_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      {
        $group: {
          _id: '$items.productId',
          nameAr: { $first: '$items.nameAr' },
          units: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineSubtotal' },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: { status: { $in: REVENUE_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$prod.category', 'OTHER'] },
          revenue: { $sum: '$items.lineSubtotal' },
          units: { $sum: '$items.quantity' },
        },
      },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorId } },
      { $group: { _id: { orderId: '$_id', status: '$status' } } },
      { $group: { _id: '$_id.status', count: { $sum: 1 } } },
    ]),
  ])

  const monthlyMap = new Map()
  for (const x of monthlyAgg) {
    const key = `${x._id.y}-${String(x._id.m).padStart(2, '0')}`
    monthlyMap.set(key, {
      revenue: +(x.revenue || 0).toFixed(3),
      orders: x.orders || 0,
      units: x.units || 0,
    })
  }
  const monthlyArr = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const v = monthlyMap.get(key) || { revenue: 0, orders: 0, units: 0 }
    monthlyArr.push({ key, year: y, month: m, ...v })
  }

  const kpi = kpiAgg[0] || { totalRevenue: 0, totalUnits: 0, totalOrders: 0 }
  const l30 = last30Agg[0] || { revenue: 0, units: 0, orders: 0 }
  const totalCommission = +(kpi.totalRevenue * (COMMISSION_PERCENT / 100)).toFixed(3)
  const totalNet = +(kpi.totalRevenue - totalCommission).toFixed(3)
  const avgOrderValue =
    kpi.totalOrders > 0 ? +(kpi.totalRevenue / kpi.totalOrders).toFixed(3) : 0

  const pendingShipmentsAgg = await Order.aggregate([
    { $match: { status: 'PAID' } },
    { $unwind: '$items' },
    { $match: { 'items.vendorId': vendorId } },
    { $group: { _id: '$_id' } },
    { $count: 'count' },
  ])
  const pendingShipments = pendingShipmentsAgg[0]?.count || 0

  return json({
    generatedAt: now.toISOString(),
    kpi: {
      totalRevenue: +(kpi.totalRevenue || 0).toFixed(3),
      totalUnits: kpi.totalUnits || 0,
      totalOrders: kpi.totalOrders || 0,
      totalCommission,
      totalNet,
      commissionPercent: COMMISSION_PERCENT,
      avgOrderValue,
    },
    last30Days: {
      revenue: +(l30.revenue || 0).toFixed(3),
      orders: l30.orders || 0,
      units: l30.units || 0,
    },
    products: {
      total: productsTotal,
      active: productsActive,
      lowStock: productsLowStock,
    },
    pendingShipments,
    monthly: monthlyArr,
    topProducts: topProductsAgg.map((x) => ({
      id: x._id,
      nameAr: x.nameAr || 'منتج',
      units: x.units,
      revenue: +(x.revenue || 0).toFixed(3),
    })),
    byCategory: byCategoryAgg.map((x) => ({
      category: x._id || 'OTHER',
      revenue: +(x.revenue || 0).toFixed(3),
      units: x.units || 0,
    })),
    orderStatus: statusAgg.map((x) => ({
      status: x._id,
      count: x.count,
    })),
  })
}
