import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleBroadcastSend } from '@/lib/api/broadcast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Sending can take a while (rate-limited Resend loop) — give plenty of headroom.
export const maxDuration = 300

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleBroadcastSend(request))
}
