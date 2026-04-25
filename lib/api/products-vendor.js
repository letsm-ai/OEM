/**
 * Vendor product CRUD (POST/PUT/DELETE /products/:id and GET /vendor/products).
 * Public product endpoints (GET /products, GET /products/:id, etc.) remain in the
 * dispatcher for now (they share AI-search caching state).
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product, Order } from '@/lib/models'
import { CATEGORY_KEYS } from '@/lib/store'
import { normalizeTags } from '@/lib/tags'
import { sanitizeVariants } from '@/lib/variants'
import { recordStockMovement } from '@/lib/inventory'
import { json, err, requireAuth } from './_helpers'

async function ensureVendor(session) {
  const unauth = requireAuth(session)
  if (unauth) return { error: unauth, dbUser: null }
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser) return { error: err('المستخدم غير موجود', 404), dbUser: null }
  if (dbUser.role !== 'VENDOR' && dbUser.role !== 'ADMIN') {
    return { error: err('صلاحيات بائع مطلوبة', 403), dbUser: null }
  }
  return { error: null, dbUser }
}

function validateImages(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter(
      (s) =>
        typeof s === 'string' &&
        /^data:image\/(png|jpe?g|webp|gif);base64,/.test(s) &&
        s.length <= 2_000_000
    )
    .slice(0, 5)
}

export async function handleProductCreate(request) {
  const session = await getServerSession(authOptions)
  const { error, dbUser } = await ensureVendor(session)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const nameAr = String(body?.nameAr || '').trim()
  const price = Number(body?.price)
  const category = String(body?.category || '').trim()
  if (!nameAr || nameAr.length < 2) return err('اسم المنتج مطلوب', 400)
  if (!Number.isFinite(price) || price < 0) return err('السعر غير صحيح', 400)
  if (!CATEGORY_KEYS.includes(category)) return err('الفئة غير صحيحة', 400)

  const images = validateImages(body?.images)
  const stock = Math.max(0, parseInt(body?.stock || 0, 10) || 0)
  const lowStockThreshold = Math.max(0, parseInt(body?.lowStockThreshold ?? 5, 10) || 0)
  const tags = normalizeTags(body?.tags)
  const subcategory = String(body?.subcategory || '').trim().slice(0, 40)
  const vres = sanitizeVariants(body?.variants)
  if (!vres.ok) return err(vres.error, 400)

  const product = await Product.create({
    vendorId: session.user.id,
    nameAr,
    nameEn: String(body?.nameEn || '').trim(),
    description: String(body?.description || '').slice(0, 3000),
    price: +price.toFixed(3),
    category,
    subcategory,
    images,
    stock: vres.hasVariants ? vres.aggregatedStock : stock,
    lowStockThreshold,
    tags,
    hasVariants: vres.hasVariants,
    variants: vres.variants,
    isActive: true,
    salesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  if (vres.hasVariants) {
    for (const v of vres.variants) {
      if ((v.stock || 0) > 0) {
        await recordStockMovement({
          productId: product._id,
          vendorId: session.user.id,
          variantId: v.id,
          variantName: v.name,
          type: 'INIT',
          qtyBefore: 0,
          qtyAfter: v.stock,
          qtyDelta: v.stock,
          note: 'إنشاء المنتج',
          createdBy: session.user.id,
          createdByName: dbUser.name || '',
        })
      }
    }
  } else if (stock > 0) {
    await recordStockMovement({
      productId: product._id,
      vendorId: session.user.id,
      type: 'INIT',
      qtyBefore: 0,
      qtyAfter: stock,
      qtyDelta: stock,
      note: 'إنشاء المنتج',
      createdBy: session.user.id,
      createdByName: dbUser.name || '',
    })
  }
  const po = product.toObject()
  return json({
    success: true,
    product: { id: product._id, ...po, _id: undefined },
  })
}

export async function handleProductUpdate(id, request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const product = await Product.findById(id)
  if (!product) return err('المنتج غير موجود', 404)
  const isOwner = product.vendorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOwner && !isAdmin) return err('لا يمكنك تعديل هذا المنتج', 403)

  const body = await request.json().catch(() => ({}))
  if (body.nameAr !== undefined) {
    const v = String(body.nameAr).trim()
    if (v.length < 2) return err('اسم المنتج مطلوب', 400)
    product.nameAr = v
  }
  if (body.nameEn !== undefined) product.nameEn = String(body.nameEn).trim()
  if (body.description !== undefined) {
    product.description = String(body.description).slice(0, 3000)
  }
  if (body.price !== undefined) {
    const p = Number(body.price)
    if (!Number.isFinite(p) || p < 0) return err('السعر غير صحيح', 400)
    product.price = +p.toFixed(3)
  }
  if (body.category !== undefined) {
    if (!CATEGORY_KEYS.includes(body.category)) return err('الفئة غير صحيحة', 400)
    product.category = body.category
  }
  if (body.stock !== undefined) {
    product.stock = Math.max(0, parseInt(body.stock, 10) || 0)
  }
  if (body.isActive !== undefined) product.isActive = !!body.isActive
  if (body.lowStockThreshold !== undefined) {
    product.lowStockThreshold = Math.max(0, parseInt(body.lowStockThreshold, 10) || 0)
  }
  if (body.tags !== undefined) product.tags = normalizeTags(body.tags)
  if (body.subcategory !== undefined) {
    product.subcategory = String(body.subcategory || '').trim().slice(0, 40)
  }
  if (body.variants !== undefined) {
    const vres = sanitizeVariants(body.variants)
    if (!vres.ok) return err(vres.error, 400)
    product.variants = vres.variants
    product.hasVariants = vres.hasVariants
    if (vres.hasVariants) product.stock = vres.aggregatedStock
  }
  if (Array.isArray(body.images)) {
    product.images = validateImages(body.images)
  }
  product.updatedAt = new Date()
  await product.save()
  const po = product.toObject()
  return json({
    success: true,
    product: { id: product._id, ...po, _id: undefined },
  })
}

export async function handleProductDelete(id) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const product = await Product.findById(id)
  if (!product) return err('المنتج غير موجود', 404)
  const isOwner = product.vendorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOwner && !isAdmin) return err('لا يمكنك حذف هذا المنتج', 403)

  const orderedBefore = await Order.exists({ 'items.productId': product._id })
  if (orderedBefore) {
    product.isActive = false
    product.updatedAt = new Date()
    await product.save()
    return json({ success: true, softDelete: true })
  }
  await Product.deleteOne({ _id: product._id })
  return json({ success: true })
}

export async function handleVendorProductsList() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
    return err('صلاحيات بائع مطلوبة', 403)
  }
  const products = await Product.find({ vendorId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()
  return json({
    products: products.map((p) => ({ id: p._id, ...p, _id: undefined })),
  })
}
