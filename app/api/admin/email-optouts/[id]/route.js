import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAdminOptOutDelete } from '@/lib/api/unsubscribe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function DELETE(_request, { params }) {
  return withCORS(await handleAdminOptOutDelete(params.id))
}
