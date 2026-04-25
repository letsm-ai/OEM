/**
 * Shipping quote handler — public endpoint.
 * POST /api/shipping/quote
 *
 * Body: { governorate, amount, items?: [{productId, vendorId}] }
 *
 * Logic:
 *  1. Compute base regional fee from governorate.
 *  2. If items[] are provided, look up the unique vendor IDs.
 *     If EVERY vendor in the cart has `vendorAbsorbsShipping=true`,
 *     the customer pays 0 (vendor absorbs the cost).
 *     Otherwise, customer pays the regional fee.
 *  3. Free-shipping threshold (>= FREE_SHIPPING_THRESHOLD) still applies on top.
 */
import {
  computeShippingFee,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEES_OMR,
} from '@/lib/store'
import { json } from './_helpers'
import { connectDB } from '@/lib/db'
import { User, Product } from '@/lib/models'

export async function handleShippingQuote(request) {
  const body = await request.json().catch(() => ({}))
  const gov = String(body?.governorate || '').toUpperCase()
  const amount = Number(body?.amount || 0)
  const items = Array.isArray(body?.items) ? body.items : []

  // Base regional fee
  let fee = computeShippingFee(gov, amount)
  let absorbedByVendor = false
  let vendorAbsorbsAll = false

  if (items.length > 0 && fee > 0) {
    // Collect vendor IDs from cart items.
    let vendorIds = items
      .map((it) => it?.vendorId)
      .filter(Boolean)

    // For items missing vendorId, try to derive it from product lookups.
    const productIdsNeedingLookup = items
      .filter((it) => !it?.vendorId && it?.productId)
      .map((it) => it.productId)

    if (productIdsNeedingLookup.length > 0) {
      try {
        await connectDB()
        const prods = await Product.find({ _id: { $in: productIdsNeedingLookup } })
          .select('vendorId')
          .lean()
        const lookedUp = prods.map((p) => p.vendorId).filter(Boolean)
        vendorIds = [...vendorIds, ...lookedUp]
      } catch (_) { /* ignore lookup failure → fall back to default fee */ }
    }

    const uniqueVendorIds = [...new Set(vendorIds.map(String))]
    if (uniqueVendorIds.length > 0) {
      try {
        await connectDB()
        const vendors = await User.find({ _id: { $in: uniqueVendorIds } })
          .select('_id vendorAbsorbsShipping')
          .lean()
        // Only treat as "all absorb" if we actually got data for every unique vendor.
        if (vendors.length === uniqueVendorIds.length) {
          vendorAbsorbsAll = vendors.every((v) => v.vendorAbsorbsShipping === true)
        }
        if (vendorAbsorbsAll) {
          fee = 0
          absorbedByVendor = true
        }
      } catch (_) { /* fall back to default fee */ }
    }
  }

  const freeThresholdReached = !absorbedByVendor && amount >= FREE_SHIPPING_THRESHOLD
  return json({
    governorate: gov,
    fee,
    isFree: fee === 0,
    freeThreshold: FREE_SHIPPING_THRESHOLD,
    freeThresholdReached,
    absorbedByVendor,
    allRates: SHIPPING_FEES_OMR,
  })
}
