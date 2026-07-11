import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleExpertSlots } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request, { params }) {
  return withCORS(await handleExpertSlots(params.id, request))
}
