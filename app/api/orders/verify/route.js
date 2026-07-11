import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleOrderVerify } from '@/lib/api/orders-verify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleOrderVerify(request))
}
