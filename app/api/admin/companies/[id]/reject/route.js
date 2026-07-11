import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminCompanyReject } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request, { params }) {
  return withCORS(await handleAdminCompanyReject(params.id, request))
}
