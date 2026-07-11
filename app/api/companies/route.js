import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleCompaniesList,
  handleCompanyCreate,
} from '@/lib/api/companies'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleCompaniesList(request))
}

export async function POST(request) {
  return withCORS(await handleCompanyCreate(request))
}
