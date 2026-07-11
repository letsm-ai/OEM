import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleOrdersList,
  handleOrderDetail,
} from '@/lib/api/orders-read'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleOrderDetail(params.id))
}
