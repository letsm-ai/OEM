import { withCORS, optionsResponse } from '@/lib/api/_cors'
import { handleAppointmentCancel } from '@/lib/api/experts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(_request, { params }) {
  return withCORS(await handleAppointmentCancel(params.id))
}
