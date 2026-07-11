import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleMyCompanies } from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleMyCompanies())
}
