import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAiSearch } from '@/lib/api/products-ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(request) {
  return withCORS(await handleAiSearch(request))
}
