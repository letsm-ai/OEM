/**
 * Product Reviews endpoints.
 *   GET  /products/:id/reviews
 *   POST /products/:id/reviews
 *   GET  /products/:id/my-review-status
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Product, ProductReview, Order, User } from '@/lib/models'
import { json, err, requireAuth } from './_helpers'

export async function handleReviewsList(productId) {
  await connectDB()
  const product = await Product.findById(productId).select({ _id: 1 }).lean()
  if (!product) return err('المنتج غير موجود', 404)
  const reviews = await ProductReview.find({ productId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  const userIds = [...new Set(reviews.map((r) => r.userId))]
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, name: 1, photo: 1 })
    .lean()
  const uMap = Object.fromEntries(users.map((u) => [u._id, u]))
  return json({
    reviews: reviews.map((r) => ({
      id: r._id,
      rating: r.rating,
      comment: r.comment || '',
      createdAt: r.createdAt,
      clientName: uMap[r.userId]?.name || 'عميل',
      clientPhoto: uMap[r.userId]?.photo || '',
    })),
  })
}

export async function handleReviewCreate(request, productId) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const product = await Product.findById(productId)
  if (!product) return err('المنتج غير موجود', 404)
  const body = await request.json().catch(() => ({}))
  const rating = Number(body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return err('التقييم يجب أن يكون بين 1 و 5 نجوم', 400)
  }
  const comment = String(body?.comment || '').trim().slice(0, 1000)

  if (String(product.vendorId) === String(session.user.id)) {
    return err('لا يمكنك تقييم منتجك الخاص', 400)
  }

  const purchase = await Order.findOne({
    buyerId: session.user.id,
    'items.productId': productId,
    status: { $in: ['PAID', 'SHIPPED', 'DELIVERED'] },
  })
    .select({ _id: 1 })
    .lean()
  if (!purchase) {
    return err('يجب شراء المنتج أولاً لتتمكن من تقييمه', 403)
  }

  const existing = await ProductReview.findOne({
    productId,
    userId: session.user.id,
  }).lean()
  if (existing) {
    return err('لقد قمت بتقييم هذا المنتج مسبقاً', 409)
  }

  const review = await ProductReview.create({
    productId,
    userId: session.user.id,
    orderId: purchase._id,
    rating,
    comment,
  })

  const agg = await ProductReview.aggregate([
    { $match: { productId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])
  const avg = agg[0]?.avg || 0
  const count = agg[0]?.count || 0
  product.rating = Math.round(avg * 100) / 100
  product.reviewCount = count
  product.updatedAt = new Date()
  await product.save()

  return json({
    success: true,
    review: {
      id: review._id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    },
    product: { rating: product.rating, reviewCount: product.reviewCount },
  })
}

export async function handleMyReviewStatus(productId) {
  await connectDB()
  const product = await Product.findById(productId)
    .select({ _id: 1, vendorId: 1 })
    .lean()
  if (!product) return err('المنتج غير موجود', 404)
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return json({
      hasPurchased: false,
      alreadyReviewed: false,
      canReview: false,
      loggedIn: false,
    })
  }
  const isOwnProduct = String(product.vendorId) === String(session.user.id)
  const purchase = await Order.findOne({
    buyerId: session.user.id,
    'items.productId': productId,
    status: { $in: ['PAID', 'SHIPPED', 'DELIVERED'] },
  })
    .select({ _id: 1 })
    .lean()
  const existing = await ProductReview.findOne({
    productId,
    userId: session.user.id,
  })
    .select({ _id: 1, rating: 1, comment: 1, createdAt: 1 })
    .lean()
  return json({
    loggedIn: true,
    isOwnProduct,
    hasPurchased: !!purchase,
    alreadyReviewed: !!existing,
    canReview: !!purchase && !existing && !isOwnProduct,
    myReview: existing
      ? {
          id: existing._id,
          rating: existing.rating,
          comment: existing.comment,
          createdAt: existing.createdAt,
        }
      : null,
  })
}
