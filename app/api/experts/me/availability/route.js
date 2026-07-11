import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleExpertAvailabilityUpdate } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function PUT(request) {
  return withCORS(await handleExpertAvailabilityUpdate(request))
}
