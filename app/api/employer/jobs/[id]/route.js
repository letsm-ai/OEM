import { handleEmployerJobUpdate, handleEmployerJobDelete } from '@/lib/api/jobs'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }
export async function PUT(request, ctx) { return withCORS(await handleEmployerJobUpdate(request, ctx)) }
export async function PATCH(request, ctx) { return withCORS(await handleEmployerJobUpdate(request, ctx)) }
export async function DELETE(request, ctx) { return withCORS(await handleEmployerJobDelete(request, ctx)) }
