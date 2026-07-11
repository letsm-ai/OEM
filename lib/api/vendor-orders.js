import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Order } from '@/lib/models'
import { COMMISSION_PERCENT } from '@/lib/store'
import { sendOrderStatusUpdateEmail } from '@/lib/email'

/**
 * GET /vendor/orders — returns orders that contain items from the current vendor,
 * with each order pruned to only the vendor's own line items + aggregated earnings.
 */
export async function handleVendorOrdersList() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
  }
  const orders = await Order.find({ 'items.vendorId': session.user.id })
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
  const enriched = orders.map((o) => {
    const vItems = (o.items || []).filter((it) => it.vendorId === session.user.id)
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
  return NextResponse.json({
    orders: enriched,
    earnings: {
      totalSales: +totalSales.toFixed(3),
      totalCommission: +totalCommission.toFixed(3),
      totalNet: +totalNet.toFixed(3),
      commissionPercent: COMMISSION_PERCENT,
      orderCount: enriched.length,
    },
  })
}

/**
 * PATCH /vendor/orders/[id]/status — vendor updates their shipment status.
 * Body: { status: 'SHIPPED'|'DELIVERED'|'CANCELLED', trackingNumber?, carrier?, note? }
 * Enforces valid state transitions and emails the buyer on change.
 */
export async function handleVendorOrderStatus(id, request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'صلاحيات بائع مطلوبة' }, { status: 403 })
  }
  const order = await Order.findById(id)
  if (!order) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  const hasItems = (order.items || []).some(
    (it) => it.vendorId === session.user.id
  )
  if (!hasItems && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'لا يمكنك تعديل حالة هذا الطلب' },
      { status: 403 }
    )
  }
  const body = await request.json().catch(() => ({}))
  const newStatus = String(body?.status || '').toUpperCase()
  const allowed = ['SHIPPED', 'DELIVERED', 'CANCELLED']
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'الحالة غير صحيحة' }, { status: 400 })
  }
  const valid = {
    PAID: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  }
  const currentAllowed = valid[order.status] || []
  if (!currentAllowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `لا يمكن الانتقال من ${order.status} إلى ${newStatus}` },
      { status: 400 }
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

  return NextResponse.json({
    success: true,
    order: { id: order._id, ...order.toObject(), _id: undefined },
  })
}
