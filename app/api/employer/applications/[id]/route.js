import { handleEmployerApplicationUpdate } from '@/lib/api/jobs'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }
export async function PATCH(request, ctx) { return withCORS(await handleEmployerApplicationUpdate(request, ctx)) }
