import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleTemplatesList,
  handleTemplatesCreate,
} from '@/lib/api/broadcast-templates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleTemplatesList())
}

export async function POST(request) {
  return withCORS(await handleTemplatesCreate(request))
}
