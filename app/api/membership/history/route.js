import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleMembershipHistory } from '@/lib/api/membership'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleMembershipHistory())
}
