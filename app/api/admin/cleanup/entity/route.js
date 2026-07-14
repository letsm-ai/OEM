import { handleCleanupDeleteEntity } from '@/lib/api/admin-cleanup'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function DELETE(request) {
  return withCORS(await handleCleanupDeleteEntity(request))
}
