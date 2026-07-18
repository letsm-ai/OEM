import { handleEmployerJobsList, handleEmployerJobCreate } from '@/lib/api/jobs'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }
export async function GET() { return withCORS(await handleEmployerJobsList()) }
export async function POST(request) { return withCORS(await handleEmployerJobCreate(request)) }
