import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Product, User } from '@/lib/models'
import { CATEGORY_KEYS, FREE_SHIPPING_THRESHOLD } from '@/lib/store'

/**
 * GET /tags/popular?limit=20
 * Aggregates the top N tags from active products.
 */
export async function handleTagsPopular(request) {
  await connectDB()
  const url = new URL(request.url)
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1),
    100
  )
  const agg = await Product.aggregate([
    { $match: { isActive: true, tags: { $exists: true, $ne: [] } } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ])
  return NextResponse.json({
    tags: agg.map((t) => ({ tag: t._id, count: t.count })),
  })
}

/**
 * GET /products — public marketplace list with rich filters.
 * Query: ?search&category&subcategory&sort&tags&minPrice&maxPrice&minRating&freeShipping&limit
 */
export async function handleProductsList(request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('search') || '').trim()
  const category = url.searchParams.get('category') || ''
  const subcategory = (url.searchParams.get('subcategory') || '').trim()
  const sort = (url.searchParams.get('sort') || 'newest').toLowerCase()
  const tagsParam = (url.searchParams.get('tags') || '').trim()
  const minPriceParam = url.searchParams.get('minPrice')
  const maxPriceParam = url.searchParams.get('maxPrice')
  const minRatingParam = url.searchParams.get('minRating')
  const freeShippingParam = url.searchParams.get('freeShipping') === '1'
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1),
    500
  )
  await connectDB()
  const query = { isActive: true }
  if (category && CATEGORY_KEYS.includes(category)) {
    query.category = category
  }
  if (subcategory) {
    query.subcategory = subcategory
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }, { tags: rx }]
  }
  if (tagsParam) {
    const list = tagsParam
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    if (list.length > 0) query.tags = { $in: list }
  }
  const minPrice = minPriceParam ? Number(minPriceParam) : null
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : null
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    query.price = {}
    if (Number.isFinite(minPrice)) query.price.$gte = minPrice
    if (Number.isFinite(maxPrice)) query.price.$lte = maxPrice
  }
  const minRating = minRatingParam ? Number(minRatingParam) : null
  if (Number.isFinite(minRating) && minRating > 0) {
    query.rating = { $gte: minRating }
  }
  if (freeShippingParam) {
    query.price = { ...(query.price || {}), $gte: FREE_SHIPPING_THRESHOLD }
  }
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    popular: { salesCount: -1 },
  }
  const sortObj = sortMap[sort] || sortMap.newest
  const products = await Product.find(query).sort(sortObj).limit(limit).lean()
  const vendorIds = Array.from(new Set(products.map((p) => p.vendorId)))
  const vendors = await User.find({
    _id: { $in: vendorIds },
    role: { $in: ['VENDOR', 'ADMIN'] },
  })
    .select({ _id: 1, name: 1, vendorProfile: 1 })
    .lean()
  const vendorMap = Object.fromEntries(
    vendors.map((v) => [
      v._id,
      {
        name: v.vendorProfile?.businessName || v.name,
        slug: v.vendorProfile?.slug || '',
        logo: v.vendorProfile?.logo || '',
      },
    ])
  )
  return NextResponse.json({
    products: products
      .filter((p) => vendorMap[p.vendorId])
      .map((p) => ({
        id: p._id,
        ...p,
        _id: undefined,
        vendorName: vendorMap[p.vendorId]?.name || 'تاجر',
        vendorSlug: vendorMap[p.vendorId]?.slug || '',
        vendorLogo: vendorMap[p.vendorId]?.logo || '',
      })),
  })
}

/** GET /products/[id] — public single-product detail with vendor embed. */
export async function handleProductDetail(id) {
  await connectDB()
  const p = await Product.findById(id).lean()
  if (!p) {
    return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
  }
  const vendor = await User.findById(p.vendorId)
    .select({ _id: 1, name: 1, email: 1, role: 1, vendorProfile: 1 })
    .lean()
  return NextResponse.json({
    product: {
      id: p._id,
      ...p,
      _id: undefined,
      vendor: vendor
        ? {
            id: vendor._id,
            name: vendor.vendorProfile?.businessName || vendor.name,
            slug: vendor.vendorProfile?.slug || '',
            logo: vendor.vendorProfile?.logo || '',
            tagline: vendor.vendorProfile?.tagline || '',
            role: vendor.role,
          }
        : null,
    },
  })
}

/**
 * GET /products/[id]/related — up to 8 related products (same category → same
 * vendor → other active) each with vendor slug/name for UI display.
 */
export async function handleProductRelated(id) {
  await connectDB()
  const p = await Product.findById(id).select({ _id: 1, vendorId: 1, category: 1 }).lean()
  if (!p) {
    return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
  }
  const limit = 8
  let related = await Product.find({
    _id: { $ne: id },
    category: p.category,
    isActive: true,
    stock: { $gt: 0 },
  })
    .sort({ salesCount: -1, createdAt: -1 })
    .limit(limit)
    .lean()
  if (related.length < limit) {
    const existingIds = new Set(related.map((r) => r._id))
    existingIds.add(id)
    const fill = await Product.find({
      _id: { $nin: [...existingIds] },
      vendorId: p.vendorId,
      isActive: true,
      stock: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .limit(limit - related.length)
      .lean()
    related = [...related, ...fill]
  }
  if (related.length < limit) {
    const existingIds = new Set(related.map((r) => r._id))
    existingIds.add(id)
    const fill = await Product.find({
      _id: { $nin: [...existingIds] },
      isActive: true,
      stock: { $gt: 0 },
    })
      .sort({ salesCount: -1, createdAt: -1 })
      .limit(limit - related.length)
      .lean()
    related = [...related, ...fill]
  }
  const vendorIds = [...new Set(related.map((r) => r.vendorId))]
  const vendors = await User.find({ _id: { $in: vendorIds } })
    .select({ _id: 1, name: 1, vendorProfile: 1 })
    .lean()
  const vMap = Object.fromEntries(vendors.map((v) => [v._id, v]))
  return NextResponse.json({
    products: related.map((r) => ({
      id: r._id,
      ...r,
      _id: undefined,
      vendorName:
        vMap[r.vendorId]?.vendorProfile?.businessName ||
        vMap[r.vendorId]?.name ||
        'تاجر',
      vendorSlug: vMap[r.vendorId]?.vendorProfile?.slug || '',
    })),
  })
}
