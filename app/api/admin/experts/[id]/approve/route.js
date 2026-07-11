import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminExpertApprove } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(_request, { params }) {
  return withCORS(await handleAdminExpertApprove(params.id))
}
