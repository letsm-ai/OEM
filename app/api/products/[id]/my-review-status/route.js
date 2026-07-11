import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleMyReviewStatus } from '@/lib/api/reviews'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleMyReviewStatus(params.id))
}
