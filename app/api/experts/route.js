import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleExpertsList } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleExpertsList(request))
}
