import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleProductsList,
  handleProductDetail,
  handleProductRelated,
} from '@/lib/api/products-public'
import {
  handleProductCreate,
  handleProductUpdate,
  handleProductDelete,
} from '@/lib/api/products-vendor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleProductsList(request))
}

export async function POST(request) {
  return withCORS(await handleProductCreate(request))
}
