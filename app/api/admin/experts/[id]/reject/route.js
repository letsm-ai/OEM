import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminExpertReject } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request, { params }) {
  return withCORS(await handleAdminExpertReject(params.id, request))
}
