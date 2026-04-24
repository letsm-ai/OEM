/**
 * Wishlist endpoints.
 *   GET    /wishlist
 *   POST   /wishlist/:productId (idempotent)
 *   DELETE /wishlist/:productId
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product } from '@/lib/models'
import { json, err, requireAuth } from './_helpers'

export async function handleWishlistList() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id)
    .select({ wishlist: 1 })
    .lean()
  const ids = user?.wishlist || []
  if (ids.length === 0) return json({ items: [], count: 0 })
  const products = await Product.find({
    _id: { $in: ids },
    isActive: true,
  }).lean()
  const vendorIds = [...new Set(products.map((p) => p.vendorId))]
  const vendors = await User.find({ _id: { $in: vendorIds } })
    .select({ _id: 1, name: 1, vendorProfile: 1 })
    .lean()
  const vMap = Object.fromEntries(vendors.map((v) => [v._id, v]))
  const items = products.map((p) => ({
    id: p._id,
    ...p,
    _id: undefined,
    vendorName:
      vMap[p.vendorId]?.vendorProfile?.businessName ||
      vMap[p.vendorId]?.name ||
      'تاجر',
    vendorSlug: vMap[p.vendorId]?.vendorProfile?.slug || '',
  }))
  const orderMap = Object.fromEntries(ids.map((id, i) => [id, i]))
  items.sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0))
  return json({ items, count: items.length })
}

export async function handleWishlistAdd(productId) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const product = await Product.findById(productId)
    .select({ _id: 1, isActive: 1 })
    .lean()
  if (!product) return err('المنتج غير موجود', 404)
  const user = await User.findById(session.user.id)
  if (!user) return err('المستخدم غير موجود', 404)
  const list = Array.isArray(user.wishlist) ? user.wishlist : []
  if (list.includes(productId)) {
    return json({ success: true, alreadyInWishlist: true, count: list.length })
  }
  user.wishlist = [productId, ...list].slice(0, 500)
  await user.save()
  return json({ success: true, count: user.wishlist.length })
}

export async function handleWishlistRemove(productId) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return err('المستخدم غير موجود', 404)
  const list = Array.isArray(user.wishlist) ? user.wishlist : []
  const next = list.filter((id) => id !== productId)
  if (next.length === list.length) {
    return json({ success: true, notFound: true, count: list.length })
  }
  user.wishlist = next
  await user.save()
  return json({ success: true, count: next.length })
}
