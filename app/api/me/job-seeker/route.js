import { handleSeekerGet, handleSeekerUpsert } from '@/lib/api/jobs'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() { return optionsResponse() }
export async function GET() { return withCORS(await handleSeekerGet()) }
export async function PUT(request) { return withCORS(await handleSeekerUpsert(request)) }
export async function POST(request) { return withCORS(await handleSeekerUpsert(request)) }
