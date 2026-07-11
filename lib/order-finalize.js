import { Order, Coupon, CouponRedemption, User } from '@/lib/models'
import { COMMISSION_PERCENT } from '@/lib/store'
import {
  sendOrderConfirmationEmail,
  sendVendorNewOrderEmail,
} from '@/lib/email'

/**
 * Idempotently mark an order as PAID and fire all post-payment side-effects:
 *   - Update status/paymentStatus/paidAt + push PAID into statusHistory
 *   - Redeem the applied coupon (recording redemption + incrementing usedCount)
 *   - Send order confirmation email to the buyer
 *   - Notify each vendor (with their own line items + commission breakdown)
 *
 * Stock is NOT decremented here — stock is already reserved at order-creation
 * time (both COD and Thawani PENDING), so calling this a second time is safe.
 */
export async function finalizeOrderPayment(order, buyer) {
  try {
    const fresh = await Order.findById(order._id)
    if (!fresh) return
    if (fresh.paymentProcessedSideEffects) return
    fresh.status = 'PAID'
    fresh.paymentStatus = 'PAID'
    fresh.paidAt = fresh.paidAt || new Date()
    fresh.paymentProcessedSideEffects = true
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

    // ---- Coupon redemption ----
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

    // ---- Emails (fire-and-forget) ----
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
