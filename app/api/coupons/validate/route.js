import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleCouponValidate } from '@/lib/api/coupons'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleCouponValidate(request))
}
