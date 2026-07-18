import { handleAdminJobUpdate, handleAdminJobDelete } from '@/lib/api/jobs'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }
export async function PATCH(request, ctx) { return withCORS(await handleAdminJobUpdate(request, ctx)) }
export async function DELETE(request, ctx) { return withCORS(await handleAdminJobDelete(request, ctx)) }
