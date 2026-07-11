import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handlePushBroadcast } from '@/lib/api/push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handlePushBroadcast(request))
}
