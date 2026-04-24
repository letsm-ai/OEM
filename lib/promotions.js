// Helpers for Promotions (عروض ترويجية).
// Used in POST /orders to compute promo discounts on cart items.

/**
 * Apply BUY_X_GET_Y to a set of lines from the same vendor.
 * Logic: for each applicable line, determine eligible units (line.quantity // buyQty * (buyQty+getQty)).
 * Then subtract getQty units worth at getDiscountPercent from each group.
 * Applies to the CHEAPEST units first when productIds is empty (best-effort).
 * Returns an object { discount, notes: [string] }.
 */
export function applyBuyXGetY(lines, promo) {
  const {
    buyQty = 2,
    getQty = 1,
    getDiscountPercent = 100,
    productIds = [],
  } = promo
  const applicable = productIds.length
    ? lines.filter((l) => productIds.includes(String(l.productId)))
    : lines
  if (applicable.length === 0) return { discount: 0, notes: [] }

  const notes = []
  let totalDiscount = 0

  // For simplicity, apply BUY_X_GET_Y per line (group-wise).
  // Advanced: merge across lines sorted by unitPrice ascending. We'll do the simpler per-line here.
  for (const line of applicable) {
    const qty = line.quantity
    const groupSize = buyQty + getQty
    const fullGroups = Math.floor(qty / groupSize)
    if (fullGroups <= 0) continue
    const freeUnits = fullGroups * getQty
    const perUnitDiscount = line.unitPrice * (getDiscountPercent / 100)
    const lineDiscount = freeUnits * perUnitDiscount
    totalDiscount += lineDiscount
    notes.push(
      `"${line.nameAr}" × ${qty} → ${freeUnits} ${getDiscountPercent === 100 ? 'مجاناً' : `بخصم ${getDiscountPercent}%`}`
    )
  }
  return { discount: +totalDiscount.toFixed(3), notes }
}

/**
 * Apply TIER: given a vendor subtotal (after BXGY) and promo.tiers (ascending by minSpend),
 * find the matching tier and apply its percent.
 */
export function applyTier(vendorSubtotal, promo) {
  const tiers = Array.isArray(promo.tiers) ? [...promo.tiers] : []
  if (tiers.length === 0 || vendorSubtotal <= 0) return { discount: 0, notes: [] }
  tiers.sort((a, b) => a.minSpend - b.minSpend)
  let active = null
  for (const t of tiers) {
    if (vendorSubtotal >= Number(t.minSpend || 0)) active = t
  }
  if (!active) return { discount: 0, notes: [] }
  const discount = +(vendorSubtotal * (Number(active.percent || 0) / 100)).toFixed(3)
  if (discount <= 0) return { discount: 0, notes: [] }
  return {
    discount,
    notes: [`خصم تدريجي ${active.percent}% على طلبات ≥ ${active.minSpend} ر.ع`],
  }
}

/**
 * Run all active promotions over the resolved cart lines.
 * Returns { totalDiscount, appliedPromotions: [{promoId, nameAr, type, discount, notes}] }
 * @param {Array} lines — resolvedItems each with {productId, vendorId, unitPrice, quantity, nameAr}
 * @param {Array} promos — all active vendor promotions (already filtered by date window)
 */
export function applyAllPromotions(lines, promos) {
  if (!lines?.length || !promos?.length) {
    return { totalDiscount: 0, appliedPromotions: [] }
  }
  // Sort promotions by priority desc then createdAt asc
  const sorted = [...promos].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  )

  // Group lines by vendor for TIER application
  const linesByVendor = new Map()
  for (const l of lines) {
    if (!linesByVendor.has(l.vendorId)) linesByVendor.set(l.vendorId, [])
    linesByVendor.get(l.vendorId).push(l)
  }

  const applied = []
  let totalDiscount = 0

  // Phase 1: BUY_X_GET_Y (per vendor, per applicable product set)
  for (const promo of sorted.filter((p) => p.type === 'BUY_X_GET_Y')) {
    const vendorLines = linesByVendor.get(promo.vendorId) || []
    if (vendorLines.length === 0) continue
    const res = applyBuyXGetY(vendorLines, promo)
    if (res.discount > 0) {
      applied.push({
        promoId: promo._id,
        nameAr: promo.nameAr,
        type: 'BUY_X_GET_Y',
        discount: res.discount,
        notes: res.notes,
      })
      totalDiscount += res.discount
    }
  }

  // Phase 2: TIER — compute vendor subtotal AFTER BXGY (simple model: subtract bxgy discount)
  for (const promo of sorted.filter((p) => p.type === 'TIER')) {
    const vendorLines = linesByVendor.get(promo.vendorId) || []
    if (vendorLines.length === 0) continue
    let vendorSubtotal = vendorLines.reduce((s, l) => s + l.lineSubtotal, 0)
    // subtract BXGY already-applied for this vendor
    const prevBXGY = applied
      .filter((a) => a.type === 'BUY_X_GET_Y')
      .reduce((s, a) => s + a.discount, 0)
    vendorSubtotal = Math.max(0, vendorSubtotal - prevBXGY)
    const res = applyTier(vendorSubtotal, promo)
    if (res.discount > 0) {
      applied.push({
        promoId: promo._id,
        nameAr: promo.nameAr,
        type: 'TIER',
        discount: res.discount,
        notes: res.notes,
      })
      totalDiscount += res.discount
    }
  }

  return { totalDiscount: +totalDiscount.toFixed(3), appliedPromotions: applied }
}

/**
 * Given a list of products, tag each with any active promo badges.
 * Returns: { promoIdsByProduct: Map<productId, Array<{nameAr, type}>> }
 */
export function indexPromosByProduct(products, promos) {
  const map = new Map()
  for (const p of promos) {
    const ids = Array.isArray(p.productIds) && p.productIds.length > 0
      ? p.productIds
      : null // null = all vendor products
    for (const prod of products) {
      if (prod.vendorId !== p.vendorId) continue
      if (ids && !ids.includes(String(prod._id || prod.id))) continue
      const key = String(prod._id || prod.id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({
        promoId: p._id,
        nameAr: p.nameAr,
        type: p.type,
      })
    }
  }
  return map
}
