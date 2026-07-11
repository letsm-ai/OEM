import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleOrdersList } from '@/lib/api/orders-read'
import { handleOrderCreate } from '@/lib/api/orders-create'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Checkout can be slow when Thawani session creation + stock reservation
// + coupon redemption all run in sequence.
export const maxDuration = 60

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleOrdersList())
}

export async function POST(request) {
  return withCORS(await handleOrderCreate(request))
}
