import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminUserPatch } from '@/lib/api/admin-users'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function PATCH(request, { params }) {
  return withCORS(await handleAdminUserPatch(params.id, request))
}
