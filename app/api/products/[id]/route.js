import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleProductDetail,
  handleProductRelated,
} from '@/lib/api/products-public'
import {
  handleProductUpdate,
  handleProductDelete,
} from '@/lib/api/products-vendor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleProductDetail(params.id))
}

export async function PUT(request, { params }) {
  return withCORS(await handleProductUpdate(params.id, request))
}

export async function DELETE(_request, { params }) {
  return withCORS(await handleProductDelete(params.id))
}
