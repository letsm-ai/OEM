import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleVendorOrderStatus } from '@/lib/api/vendor-orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function PATCH(request, { params }) {
  return withCORS(await handleVendorOrderStatus(params.id, request))
}
