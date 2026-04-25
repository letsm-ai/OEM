/**
 * Vendor promotions (BUY_X_GET_Y, TIER) + public per-product promo lookup.
 *   GET    /vendor/promotions
 *   POST   /vendor/promotions
 *   PUT    /vendor/promotions/:id
 *   DELETE /vendor/promotions/:id
 *   GET    /products/:id/promotions
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product, Promotion } from '@/lib/models'
import { json, err, requireAuth } from './_helpers'

async function ensureVendor(session) {
  const unauth = requireAuth(session)
  if (unauth) return { error: unauth }
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser || (dbUser.role !== 'VENDOR' && dbUser.role !== 'ADMIN')) {
    return { error: err('صلاحيات بائع مطلوبة', 403) }
  }
  return { error: null }
}

export async function handleVendorPromotionsList() {
  const session = await getServerSession(authOptions)
  const { error } = await ensureVendor(session)
  if (error) return error
  const promos = await Promotion.find({ vendorId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()
  return json({
    promotions: promos.map((p) => ({ id: p._id, ...p, _id: undefined })),
  })
}

export async function handleVendorPromotionCreate(request) {
  const session = await getServerSession(authOptions)
  const { error } = await ensureVendor(session)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const type = String(body?.type || '').toUpperCase()
  if (!['BUY_X_GET_Y', 'TIER'].includes(type)) {
    return err('نوع العرض غير صحيح', 400)
  }
  const nameAr = String(body?.nameAr || '').trim()
  if (!nameAr || nameAr.length > 100) {
    return err('اسم العرض مطلوب (≤ 100 حرف)', 400)
  }
  const doc = {
    vendorId: session.user.id,
    type,
    nameAr,
    descriptionAr: String(body?.descriptionAr || '').slice(0, 500),
    productIds: Array.isArray(body?.productIds) ? body.productIds.slice(0, 100) : [],
    isActive: body?.isActive !== false,
    priority: parseInt(body?.priority || 0, 10) || 0,
    startDate: body?.startDate ? new Date(body.startDate) : new Date(),
    endDate: body?.endDate ? new Date(body.endDate) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  if (type === 'BUY_X_GET_Y') {
    doc.buyQty = Math.max(1, parseInt(body?.buyQty || 2, 10) || 2)
    doc.getQty = Math.max(1, parseInt(body?.getQty || 1, 10) || 1)
    doc.getDiscountPercent = Math.max(
      1,
      Math.min(100, parseInt(body?.getDiscountPercent || 100, 10) || 100)
    )
  } else if (type === 'TIER') {
    const tiers = Array.isArray(body?.tiers) ? body.tiers : []
    if (tiers.length === 0) return err('أضف مستوى واحد على الأقل', 400)
    const clean = []
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]
      const minSpend = Number(t.minSpend)
      const percent = Number(t.percent)
      if (!Number.isFinite(minSpend) || minSpend < 0) {
        return err(`قيمة الحد الأدنى للمستوى ${i + 1} غير صحيحة`, 400)
      }
      if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
        return err(`نسبة الخصم للمستوى ${i + 1} يجب أن تكون 1-90%`, 400)
      }
      clean.push({ minSpend: +minSpend.toFixed(3), percent: Math.round(percent) })
    }
    doc.tiers = clean
  }
  const p = await Promotion.create(doc)
  return json({
    promotion: { id: p._id, ...p.toObject(), _id: undefined },
  })
}

export async function handleVendorPromotionAction(id, method, request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const promo = await Promotion.findById(id)
  if (!promo) return err('العرض غير موجود', 404)
  if (promo.vendorId !== session.user.id && session.user.role !== 'ADMIN') {
    return err('لا يمكنك تعديل هذا العرض', 403)
  }
  if (method === 'DELETE') {
    await Promotion.deleteOne({ _id: id })
    return json({ success: true })
  }
  const body = await request.json().catch(() => ({}))
  if (body.nameAr !== undefined) promo.nameAr = String(body.nameAr).trim().slice(0, 100)
  if (body.descriptionAr !== undefined) promo.descriptionAr = String(body.descriptionAr).slice(0, 500)
  if (body.isActive !== undefined) promo.isActive = !!body.isActive
  if (body.priority !== undefined) promo.priority = parseInt(body.priority, 10) || 0
  if (body.productIds !== undefined) promo.productIds = Array.isArray(body.productIds) ? body.productIds.slice(0, 100) : []
  if (body.startDate !== undefined) promo.startDate = body.startDate ? new Date(body.startDate) : new Date()
  if (body.endDate !== undefined) promo.endDate = body.endDate ? new Date(body.endDate) : null
  if (promo.type === 'BUY_X_GET_Y') {
    if (body.buyQty !== undefined) promo.buyQty = Math.max(1, parseInt(body.buyQty, 10) || 2)
    if (body.getQty !== undefined) promo.getQty = Math.max(1, parseInt(body.getQty, 10) || 1)
    if (body.getDiscountPercent !== undefined) promo.getDiscountPercent = Math.max(1, Math.min(100, parseInt(body.getDiscountPercent, 10) || 100))
  } else if (promo.type === 'TIER' && Array.isArray(body.tiers)) {
    const clean = []
    for (let i = 0; i < body.tiers.length; i++) {
      const t = body.tiers[i]
      const minSpend = Number(t.minSpend)
      const percent = Number(t.percent)
      if (!Number.isFinite(minSpend) || minSpend < 0 || !Number.isFinite(percent) || percent < 1 || percent > 90) continue
      clean.push({ minSpend: +minSpend.toFixed(3), percent: Math.round(percent) })
    }
    promo.tiers = clean
  }
  promo.updatedAt = new Date()
  await promo.save()
  return json({
    promotion: { id: promo._id, ...promo.toObject(), _id: undefined },
  })
}

export async function handleProductPromotions(id) {
  await connectDB()
  const p = await Product.findById(id).lean()
  if (!p) return err('المنتج غير موجود', 404)
  const now = new Date()
  const all = await Promotion.find({
    vendorId: p.vendorId,
    isActive: true,
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
    ],
  }).lean()
  const applicable = all.filter(
    (pr) => !pr.productIds?.length || pr.productIds.includes(String(id))
  )
  return json({
    promotions: applicable.map((pr) => ({
      id: pr._id,
      type: pr.type,
      nameAr: pr.nameAr,
      descriptionAr: pr.descriptionAr,
      buyQty: pr.buyQty,
      getQty: pr.getQty,
      getDiscountPercent: pr.getDiscountPercent,
      tiers: pr.tiers,
    })),
  })
}
