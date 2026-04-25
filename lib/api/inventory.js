/**
 * Vendor inventory + stock movements + stock adjust + CSV import.
 *   GET  /vendor/inventory
 *   POST /vendor/products/import
 *   GET  /vendor/products/import/template (CSV)
 *   GET  /products/:id/stock/movements
 *   POST /products/:id/stock/adjust
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product, StockMovement } from '@/lib/models'
import {
  isLowStock,
  lowStockVariants,
  recordStockMovement,
} from '@/lib/inventory'
import { json, err, requireAuth } from './_helpers'

async function ensureVendor(session) {
  const unauth = requireAuth(session)
  if (unauth) return { error: unauth, dbUser: null }
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser || (dbUser.role !== 'VENDOR' && dbUser.role !== 'ADMIN')) {
    return { error: err('صلاحيات بائع مطلوبة', 403), dbUser: null }
  }
  return { error: null, dbUser }
}

export async function handleVendorInventory(request) {
  const session = await getServerSession(authOptions)
  const { error } = await ensureVendor(session)
  if (error) return error
  const url = new URL(request.url)
  const onlyLow = url.searchParams.get('lowStock') === '1'
  const products = await Product.find({ vendorId: session.user.id }).lean()
  const enriched = products.map((p) => ({
    id: p._id,
    nameAr: p.nameAr,
    category: p.category,
    images: (p.images || []).slice(0, 1),
    price: p.price,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold ?? 5,
    isActive: p.isActive,
    hasVariants: !!p.hasVariants,
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      stock: v.stock,
      price: v.price,
    })),
    isLow: isLowStock(p),
    lowItems: lowStockVariants(p),
  }))
  const result = onlyLow ? enriched.filter((p) => p.isLow) : enriched
  return json({
    products: result,
    summary: {
      total: products.length,
      active: products.filter((p) => p.isActive).length,
      lowCount: enriched.filter((p) => p.isLow).length,
    },
  })
}

const VALID_CATEGORIES = [
  'FOOD', 'FASHION', 'ELECTRONICS', 'OFFICE',
  'HANDICRAFT', 'DIGITAL', 'OTHER',
]

export async function handleProductsImport(request) {
  const session = await getServerSession(authOptions)
  const { error, dbUser } = await ensureVendor(session)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const rows = Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) return err('لا توجد صفوف لاستيرادها', 400)
  if (rows.length > 200) return err('الحد الأقصى 200 منتج لكل استيراد', 400)
  const dryRun = !!body?.dryRun

  const results = []
  let createdCount = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {}
    const lineNo = i + 2
    const nameAr = String(
      r.nameAr ?? r.name_ar ?? r['اسم المنتج'] ?? r.name ?? ''
    ).trim()
    const nameEn = String(r.nameEn ?? r.name_en ?? r['الاسم الإنجليزي'] ?? '').trim()
    const description = String(r.description ?? r['الوصف'] ?? '').slice(0, 3000)
    const priceRaw = r.price ?? r['السعر']
    const stockRaw = r.stock ?? r['المخزون']
    const categoryRaw = String(r.category ?? r['الفئة'] ?? 'OTHER').toUpperCase().trim()
    const lowStockThresholdRaw = r.lowStockThreshold ?? r['حد التنبيه'] ?? 5

    if (!nameAr) {
      results.push({ row: lineNo, ok: false, error: 'اسم المنتج مطلوب' })
      continue
    }
    const price = Number(priceRaw)
    if (!Number.isFinite(price) || price < 0) {
      results.push({ row: lineNo, ok: false, nameAr, error: 'السعر غير صحيح' })
      continue
    }
    const stock = Math.max(0, parseInt(stockRaw, 10) || 0)
    const category = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'OTHER'
    const lowStockThreshold = Math.max(0, parseInt(lowStockThresholdRaw, 10) || 0)

    if (dryRun) {
      results.push({
        row: lineNo, ok: true, nameAr,
        preview: { price, stock, category, lowStockThreshold },
      })
      continue
    }

    try {
      const prod = await Product.create({
        vendorId: session.user.id,
        nameAr, nameEn, description,
        price: +price.toFixed(3),
        category,
        images: [], stock, lowStockThreshold,
        hasVariants: false, variants: [],
        isActive: true, salesCount: 0,
        createdAt: new Date(), updatedAt: new Date(),
      })
      createdCount += 1
      if (stock > 0) {
        await recordStockMovement({
          productId: prod._id,
          vendorId: session.user.id,
          type: 'INIT',
          qtyBefore: 0, qtyAfter: stock, qtyDelta: stock,
          note: 'استيراد CSV',
          createdBy: session.user.id,
          createdByName: dbUser.name || '',
        })
      }
      results.push({ row: lineNo, ok: true, productId: prod._id, nameAr })
    } catch (e) {
      results.push({ row: lineNo, ok: false, nameAr, error: e.message || 'فشل إنشاء المنتج' })
    }
  }

  const okCount = results.filter((x) => x.ok).length
  return json({
    success: true,
    dryRun,
    total: rows.length,
    okCount,
    failCount: results.length - okCount,
    createdCount,
    results,
  })
}

export function handleProductsImportTemplate() {
  const header = 'nameAr,nameEn,description,price,stock,category,lowStockThreshold'
  const samples = [
    'عسل سدر جبلي,Mountain Sidr Honey,عسل سدر طبيعي 100%,15.5,20,FOOD,3',
    'قميص قطني,Cotton Shirt,قميص قطني فاخر,25,50,FASHION,5',
    'سماعات بلوتوث,Bluetooth Headphones,سماعات لاسلكية,45,15,ELECTRONICS,2',
  ]
  const csv = '\uFEFF' + [header, ...samples].join('\n')
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products_template.csv"',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function handleStockMovements(productId) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const p = await Product.findById(productId).lean()
  if (!p) return err('المنتج غير موجود', 404)
  if (p.vendorId !== session.user.id && session.user.role !== 'ADMIN') {
    return err('لا يمكنك رؤية سجل هذا المنتج', 403)
  }
  const movements = await StockMovement.find({ productId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
  return json({
    movements: movements.map((m) => ({ id: m._id, ...m, _id: undefined })),
  })
}

export async function handleStockAdjust(productId, request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const product = await Product.findById(productId)
  if (!product) return err('المنتج غير موجود', 404)
  if (product.vendorId !== session.user.id && session.user.role !== 'ADMIN') {
    return err('لا يمكنك تعديل مخزون هذا المنتج', 403)
  }
  const body = await request.json().catch(() => ({}))
  const type = String(body?.type || 'ADJUST').toUpperCase()
  if (!['RESTOCK', 'ADJUST', 'RETURN'].includes(type)) {
    return err('نوع الحركة غير صحيح', 400)
  }
  const delta = parseInt(body?.delta, 10)
  if (!Number.isFinite(delta) || delta === 0) {
    return err('قيمة التعديل غير صحيحة', 400)
  }
  const variantId = String(body?.variantId || '').trim()
  const note = String(body?.note || '').slice(0, 300)
  const dbUser = await User.findById(session.user.id).lean()

  if (variantId) {
    if (!product.hasVariants || !product.variants?.length) {
      return err('المنتج لا يحتوي على خيارات', 400)
    }
    const vIdx = product.variants.findIndex((v) => v.id === variantId)
    if (vIdx < 0) return err('الخيار غير موجود', 404)
    const v = product.variants[vIdx]
    const before = Number(v.stock || 0)
    const after = Math.max(0, before + delta)
    const actualDelta = after - before
    product.variants[vIdx].stock = after
    product.stock = product.variants.reduce(
      (s, x) => s + Number(x.stock || 0),
      0
    )
    product.updatedAt = new Date()
    await product.save()
    await recordStockMovement({
      productId: product._id,
      vendorId: product.vendorId,
      variantId: v.id,
      variantName: v.name,
      type,
      qtyBefore: before,
      qtyAfter: after,
      qtyDelta: actualDelta,
      note,
      createdBy: session.user.id,
      createdByName: dbUser?.name || '',
    })
    return json({
      success: true,
      newStock: after,
      variantStock: after,
      productStock: product.stock,
      delta: actualDelta,
    })
  }

  if (product.hasVariants) {
    return err('يجب تحديد الخيار (variantId) لهذا المنتج', 400)
  }
  const before = Number(product.stock || 0)
  const after = Math.max(0, before + delta)
  const actualDelta = after - before
  product.stock = after
  product.updatedAt = new Date()
  await product.save()
  await recordStockMovement({
    productId: product._id,
    vendorId: product.vendorId,
    type,
    qtyBefore: before,
    qtyAfter: after,
    qtyDelta: actualDelta,
    note,
    createdBy: session.user.id,
    createdByName: dbUser?.name || '',
  })
  return json({
    success: true,
    newStock: after,
    productStock: after,
    delta: actualDelta,
  })
}
