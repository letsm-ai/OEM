import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleCartGet,
  handleCartUpsert,
  handleCartClear,
} from '@/lib/api/cart'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET() {
  return withCORS(await handleCartGet())
}

export async function POST(request) {
  return withCORS(await handleCartUpsert(request))
}

export async function DELETE() {
  return withCORS(await handleCartClear())
}
