import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleMembershipStartTrial } from '@/lib/api/membership'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleMembershipStartTrial(request))
}
