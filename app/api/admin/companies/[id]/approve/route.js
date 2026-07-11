import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminCompanyApprove } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(_request, { params }) {
  return withCORS(await handleAdminCompanyApprove(params.id))
}
