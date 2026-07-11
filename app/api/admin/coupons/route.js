import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleAdminCouponsList,
  handleAdminCouponCreate,
} from '@/lib/api/coupons'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleAdminCouponsList())
}

export async function POST(request) {
  return withCORS(await handleAdminCouponCreate(request))
}
