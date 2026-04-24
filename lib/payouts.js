// Helpers for vendor payout calculations.
// Computes vendor balance from DELIVERED orders minus commission and prior payouts.

import { Order, PayoutRequest } from '@/lib/models'
import { COMMISSION_PERCENT } from '@/lib/store'

const MIN_PAYOUT_AMOUNT = 10 // ر.ع عماني
export { MIN_PAYOUT_AMOUNT }

/**
 * Compute vendor balance.
 * - eligibleRevenue = sum of lineSubtotal for order.items[] where vendorId == this vendor
 *   and order.status == 'DELIVERED' (only finalized sales count).
 * - commission = eligibleRevenue * COMMISSION_PERCENT / 100
 * - paidOut = sum of PayoutRequest with status='PAID' or 'APPROVED' for this vendor
 *   (approved funds are committed; pending funds are still available to recalculate later)
 * - pendingPayout = sum of PayoutRequest with status='PENDING' for this vendor
 * - availableBalance = eligibleRevenue - commission - paidOut - pendingPayout
 */
export async function computeVendorBalance(vendorId) {
  // Aggregate delivered revenue
  const agg = await Order.aggregate([
    { $match: { status: 'DELIVERED' } },
    { $unwind: '$items' },
    { $match: { 'items.vendorId': vendorId } },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$items.lineSubtotal' },
        orders: { $addToSet: '$_id' },
        units: { $sum: '$items.quantity' },
      },
    },
    {
      $project: {
        _id: 0,
        revenue: 1,
        units: 1,
        orderCount: { $size: '$orders' },
      },
    },
  ])
  const eligibleRevenue = +((agg[0]?.revenue || 0)).toFixed(3)
  const deliveredOrderCount = agg[0]?.orderCount || 0
  const deliveredUnits = agg[0]?.units || 0
  const commission = +(eligibleRevenue * (COMMISSION_PERCENT / 100)).toFixed(3)
  const netRevenue = +(eligibleRevenue - commission).toFixed(3)

  // Sum of paid + approved (committed)
  const committedAgg = await PayoutRequest.aggregate([
    { $match: { vendorId, status: { $in: ['PAID', 'APPROVED'] } } },
    { $group: { _id: null, total: { $sum: '$amountRequested' } } },
  ])
  const committedOut = +((committedAgg[0]?.total || 0)).toFixed(3)

  const pendingAgg = await PayoutRequest.aggregate([
    { $match: { vendorId, status: 'PENDING' } },
    { $group: { _id: null, total: { $sum: '$amountRequested' } } },
  ])
  const pendingOut = +((pendingAgg[0]?.total || 0)).toFixed(3)

  const availableBalance = Math.max(0, +(netRevenue - committedOut - pendingOut).toFixed(3))

  return {
    eligibleRevenue,
    commission,
    commissionPercent: COMMISSION_PERCENT,
    netRevenue,
    committedOut, // already approved/paid
    pendingOut,   // pending requests
    availableBalance,
    deliveredOrderCount,
    deliveredUnits,
    minPayoutAmount: MIN_PAYOUT_AMOUNT,
  }
}
