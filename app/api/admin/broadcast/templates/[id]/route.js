import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleTemplatesUpdate,
  handleTemplatesDelete,
} from '@/lib/api/broadcast-templates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function PUT(request, { params }) {
  return withCORS(await handleTemplatesUpdate(request, params.id))
}

export async function PATCH(request, { params }) {
  return withCORS(await handleTemplatesUpdate(request, params.id))
}

export async function DELETE(request, { params }) {
  return withCORS(await handleTemplatesDelete(request, params.id))
}
