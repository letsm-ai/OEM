import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminVendorApplicationAction } from '@/lib/api/vendor-application'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request, { params }) {
  return withCORS(await handleAdminVendorApplicationAction(params.id, params.action, request))
}
