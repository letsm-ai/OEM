import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminCompaniesList } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleAdminCompaniesList(request))
}
