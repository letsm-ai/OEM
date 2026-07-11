import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminPayoutsList } from '@/lib/api/payouts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleAdminPayoutsList(request))
}
