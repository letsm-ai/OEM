import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleCleanupExecute } from '@/lib/api/admin-cleanup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleCleanupExecute(request))
}
