import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleExpertReviews } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleExpertReviews(params.id))
}
