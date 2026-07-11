import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminPayoutAction } from '@/lib/api/payouts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request, { params }) {
  return withCORS(await handleAdminPayoutAction(params.id, params.action, request))
}
