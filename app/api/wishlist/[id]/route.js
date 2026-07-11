import { withCORS, optionsResponse } from '@/lib/api/_cors'
import {
  handleWishlistAdd,
  handleWishlistRemove,
} from '@/lib/api/wishlist'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

export async function POST(_request, { params }) {
  return withCORS(await handleWishlistAdd(params.id))
}

export async function DELETE(_request, { params }) {
  return withCORS(await handleWishlistRemove(params.id))
}
