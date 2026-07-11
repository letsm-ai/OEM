import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleBroadcastHistory } from '@/lib/api/broadcast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request) {
  return withCORS(await handleBroadcastHistory(request))
}
