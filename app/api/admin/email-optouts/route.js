import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleAdminOptOutList,
  handleAdminOptOutExport,
} from '@/lib/api/unsubscribe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleAdminOptOutList(request))
}
