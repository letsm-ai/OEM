import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Order } from '@/lib/models'

/** GET /orders — buyer's order history (latest 100). */
export async function handleOrdersList() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  await connectDB()
  const orders = await Order.find({ buyerId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
  return NextResponse.json({
    orders: orders.map((o) => ({ id: o._id, ...o, _id: undefined })),
  })
}

/**
 * GET /orders/[id] — buyer, any vendor of the order's items, or admin can view.
 * Vendors only see their own line items (privacy).
 */
export async function handleOrderDetail(id) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  await connectDB()
  const order = await Order.findById(id).lean()
  if (!order) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  const uid = session.user.id
  const isBuyer = order.buyerId === uid
  const isVendor = (order.items || []).some((it) => it.vendorId === uid)
  const isAdmin = session.user.role === 'ADMIN'
  if (!isBuyer && !isVendor && !isAdmin) {
    return NextResponse.json({ error: 'لا يمكنك عرض هذا الطلب' }, { status: 403 })
  }
  let items = order.items
  if (isVendor && !isAdmin && !isBuyer) {
    items = items.filter((it) => it.vendorId === uid)
  }
  return NextResponse.json({
    order: { id: order._id, ...order, _id: undefined, items },
  })
}
