import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleExpertApply } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleExpertApply(request))
}
