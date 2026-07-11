import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Order } from '@/lib/models'
import { getCheckoutSession as thawaniGetSession } from '@/lib/payments/thawani'
import { finalizeOrderPayment } from '@/lib/order-finalize'

/**
 * POST /orders/verify — called from the success page after Thawani redirect.
 * Body: { sessionId?, orderId? } — at least one required.
 * Queries Thawani for authoritative status and finalises the order if paid.
 */
export async function handleOrderVerify(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const sessionId = String(body?.sessionId || '')
  const orderId = String(body?.orderId || '')
  if (!sessionId && !orderId) {
    return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 })
  }
  const order = await Order.findOne(
    sessionId ? { thawaniSessionId: sessionId } : { _id: orderId }
  )
  if (!order) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  if (String(order.buyerId) !== String(session.user.id)) {
    return NextResponse.json({ error: 'غير مصرح بالوصول لهذا الطلب' }, { status: 403 })
  }

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
  return NextResponse.json({
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
}
