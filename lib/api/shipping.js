/**
 * Shipping quote handler — public endpoint.
 * POST /api/shipping/quote
 */
import {
  computeShippingFee,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEES_OMR,
} from '@/lib/store'
import { json } from './_helpers'

export async function handleShippingQuote(request) {
  const body = await request.json().catch(() => ({}))
  const gov = String(body?.governorate || '').toUpperCase()
  const amount = Number(body?.amount || 0)
  const fee = computeShippingFee(gov, amount)
  const freeThresholdReached = amount >= FREE_SHIPPING_THRESHOLD
  return json({
    governorate: gov,
    fee,
    isFree: fee === 0,
    freeThreshold: FREE_SHIPPING_THRESHOLD,
    freeThresholdReached,
    allRates: SHIPPING_FEES_OMR,
  })
}
