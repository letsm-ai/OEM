import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleCleanupScan } from '@/lib/api/admin-cleanup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleCleanupScan())
}
