import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleAdminCouponUpdate,
  handleAdminCouponDelete,
} from '@/lib/api/coupons'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function PATCH(request, { params }) {
  return withCORS(await handleAdminCouponUpdate(request, params.id))
}

export async function DELETE(_request, { params }) {
  return withCORS(await handleAdminCouponDelete(params.id))
}
