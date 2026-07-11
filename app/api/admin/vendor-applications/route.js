import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminVendorApplicationsList } from '@/lib/api/vendor-application'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleAdminVendorApplicationsList(request))
}
