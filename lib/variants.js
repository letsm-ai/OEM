// Helpers for Product Variants (خيارات المنتج)
// Used by POST/PUT /products and POST /orders.

import { v4 as uuidv4 } from 'uuid'

/**
 * Sanitize and validate incoming variants array from the vendor.
 * Returns { ok: boolean, error?: string, variants: cleaned[], hasVariants: boolean, aggregatedStock: number }
 *
 * Rules:
 * - Max 50 variants per product.
 * - `name` required (1..80 chars).
 * - `sku` optional (0..50 chars).
 * - `price` must be ≥ 0.
 * - `stock` must be integer ≥ 0.
 * - `image` optional base64 data URL (same rules as product images).
 * - `attrs` optional plain object with simple string values.
 * - If passing an existing variant by `id`, we preserve it; otherwise generate a new uuid.
 */
export function sanitizeVariants(rawInput) {
  if (!Array.isArray(rawInput) || rawInput.length === 0) {
    return { ok: true, variants: [], hasVariants: false, aggregatedStock: 0 }
  }
  if (rawInput.length > 50) {
    return {
      ok: false,
      error: 'الحد الأقصى للخيارات هو 50',
      variants: [],
      hasVariants: false,
      aggregatedStock: 0,
    }
  }

  const cleaned = []
  const seenSkus = new Set()
  for (let i = 0; i < rawInput.length; i++) {
    const v = rawInput[i] || {}
    const name = String(v.name || '').trim().slice(0, 80)
    if (!name) {
      return {
        ok: false,
        error: `اسم الخيار رقم ${i + 1} مطلوب`,
        variants: [],
        hasVariants: false,
        aggregatedStock: 0,
      }
    }
    const sku = String(v.sku || '').trim().slice(0, 50)
    if (sku) {
      if (seenSkus.has(sku)) {
        return {
          ok: false,
          error: `رمز المنتج (SKU) مكرر: ${sku}`,
          variants: [],
          hasVariants: false,
          aggregatedStock: 0,
        }
      }
      seenSkus.add(sku)
    }
    const price = Number(v.price)
    if (!Number.isFinite(price) || price < 0) {
      return {
        ok: false,
        error: `سعر الخيار "${name}" غير صحيح`,
        variants: [],
        hasVariants: false,
        aggregatedStock: 0,
      }
    }
    const stock = Math.max(0, parseInt(v.stock, 10) || 0)
    const image =
      typeof v.image === 'string' &&
      /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v.image) &&
      v.image.length <= 2_000_000
        ? v.image
        : ''

    const attrs = {}
    if (v.attrs && typeof v.attrs === 'object' && !Array.isArray(v.attrs)) {
      for (const k of Object.keys(v.attrs)) {
        if (k.length > 40) continue
        const val = v.attrs[k]
        if (typeof val === 'string' && val.length <= 80) attrs[k] = val
      }
    }

    cleaned.push({
      id: typeof v.id === 'string' && v.id.length > 0 ? v.id : uuidv4(),
      name,
      sku,
      price: +price.toFixed(3),
      stock,
      image,
      attrs,
    })
  }

  const aggregatedStock = cleaned.reduce((s, x) => s + x.stock, 0)
  return { ok: true, variants: cleaned, hasVariants: true, aggregatedStock }
}

/**
 * Resolve a variant by id within a product. Returns { variant } or null.
 */
export function findVariant(product, variantId) {
  if (!product?.variants?.length || !variantId) return null
  return (
    product.variants.find(
      (v) => String(v.id) === String(variantId)
    ) || null
  )
}
