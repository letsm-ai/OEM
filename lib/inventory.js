// Helpers for advanced inventory management.
// Used by POST /orders (SALE movements), vendor inventory endpoints, and stock adjust endpoint.

import { StockMovement, Product } from '@/lib/models'

/**
 * Record a stock movement document. Does NOT mutate product stock — caller is responsible.
 * @param {Object} opts
 * @param {string} opts.productId
 * @param {string} opts.vendorId
 * @param {string} [opts.variantId]
 * @param {string} [opts.variantName]
 * @param {'RESTOCK'|'SALE'|'ADJUST'|'RETURN'|'INIT'} opts.type
 * @param {number} opts.qtyBefore
 * @param {number} opts.qtyAfter
 * @param {number} opts.qtyDelta
 * @param {string} [opts.note]
 * @param {string} [opts.orderId]
 * @param {string} [opts.createdBy]
 * @param {string} [opts.createdByName]
 */
export async function recordStockMovement(opts) {
  try {
    await StockMovement.create({
      productId: opts.productId,
      vendorId: opts.vendorId,
      variantId: opts.variantId || '',
      variantName: opts.variantName || '',
      type: opts.type,
      qtyBefore: Number(opts.qtyBefore || 0),
      qtyAfter: Number(opts.qtyAfter || 0),
      qtyDelta: Number(opts.qtyDelta || 0),
      note: String(opts.note || '').slice(0, 300),
      orderId: opts.orderId || '',
      createdBy: opts.createdBy || 'SYSTEM',
      createdByName: opts.createdByName || '',
      createdAt: new Date(),
    })
  } catch (e) {
    console.error('[stock] recordStockMovement failed', e)
  }
}

/**
 * Whether a product/variant is below its low-stock threshold.
 * Simple products: compare product.stock to product.lowStockThreshold.
 * Variant products: a variant is "low" if variant.stock <= threshold.
 */
export function isLowStock(product) {
  const t = Number(product?.lowStockThreshold ?? 5)
  if (product?.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((v) => Number(v.stock ?? 0) <= t)
  }
  return Number(product?.stock ?? 0) <= t
}

/**
 * Returns an array of low-stock variant info for display.
 * [{ variantId, variantName, stock, threshold }]
 */
export function lowStockVariants(product) {
  const t = Number(product?.lowStockThreshold ?? 5)
  if (!product?.hasVariants) {
    return Number(product?.stock ?? 0) <= t
      ? [{ variantId: '', variantName: '', stock: product.stock, threshold: t }]
      : []
  }
  return (product.variants || [])
    .filter((v) => Number(v.stock ?? 0) <= t)
    .map((v) => ({ variantId: v.id, variantName: v.name, stock: v.stock, threshold: t }))
}
