import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleProductRelated } from '@/lib/api/products-public'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleProductRelated(params.id))
}
