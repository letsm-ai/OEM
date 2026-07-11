import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleCompanyDetail,
  handleCompanyUpdate,
  handleCompanyDelete,
} from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request, { params }) {
  return withCORS(await handleCompanyDetail(params.id))
}

export async function PUT(request, { params }) {
  return withCORS(await handleCompanyUpdate(params.id, request))
}

export async function DELETE(_request, { params }) {
  return withCORS(await handleCompanyDelete(params.id))
}
