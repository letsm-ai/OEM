import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleBroadcastPreview } from '@/lib/api/broadcast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleBroadcastPreview(request))
}
