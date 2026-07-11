import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleReviewsList,
  handleReviewCreate,
} from '@/lib/api/reviews'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleReviewsList(params.id))
}

export async function POST(request, { params }) {
  return withCORS(await handleReviewCreate(request, params.id))
}
