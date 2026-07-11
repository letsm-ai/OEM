import { optionsResponse } from '@/lib/api/_cors'
import { handleAdminOptOutExport } from '@/lib/api/unsubscribe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  // Returns text/csv attachment — do NOT wrap with withCORS which sets JSON headers
  return await handleAdminOptOutExport()
}
