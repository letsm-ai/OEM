// Store / marketplace constants and helpers.

export const PRODUCT_CATEGORIES = [
  { key: 'FOOD', label: 'منتجات غذائية', emoji: '🍯' },
  { key: 'FASHION', label: 'ملابس وأزياء', emoji: '👗' },
  { key: 'ELECTRONICS', label: 'إلكترونيات وتقنية', emoji: '💻' },
  { key: 'OFFICE', label: 'مستلزمات مكتبية', emoji: '📎' },
  { key: 'HANDICRAFT', label: 'منتجات يدوية وتراثية', emoji: '🪡' },
  { key: 'DIGITAL', label: 'خدمات رقمية', emoji: '☁️' },
  { key: 'OTHER', label: 'أخرى', emoji: '🛒' },
]

export const CATEGORY_KEYS = PRODUCT_CATEGORIES.map((c) => c.key)

// Sub-categories per main category. Each entry: { key, labelAr }
// Used by vendor product form (cascading dropdown) and store filters.
export const SUBCATEGORIES = {
  FOOD: [
    { key: 'honey', labelAr: 'عسل' },
    { key: 'spices', labelAr: 'بهارات وتوابل' },
    { key: 'sweets', labelAr: 'حلويات ومعجنات' },
    { key: 'coffee-tea', labelAr: 'قهوة وشاي' },
    { key: 'dates', labelAr: 'تمور' },
    { key: 'oils', labelAr: 'زيوت طبيعية' },
    { key: 'organic', labelAr: 'منتجات عضوية' },
  ],
  FASHION: [
    { key: 'mens', labelAr: 'رجالي' },
    { key: 'womens', labelAr: 'نسائي' },
    { key: 'kids', labelAr: 'أطفال' },
    { key: 'dishdasha', labelAr: 'دشاديش' },
    { key: 'abayas', labelAr: 'عبايات' },
    { key: 'shoes', labelAr: 'أحذية' },
    { key: 'accessories', labelAr: 'إكسسوارات' },
    { key: 'bags', labelAr: 'حقائب' },
    { key: 'perfumes', labelAr: 'عطور' },
  ],
  ELECTRONICS: [
    { key: 'phones', labelAr: 'هواتف' },
    { key: 'laptops', labelAr: 'حواسيب' },
    { key: 'audio', labelAr: 'صوتيات وسماعات' },
    { key: 'wearables', labelAr: 'ساعات ذكية' },
    { key: 'cameras', labelAr: 'كاميرات' },
    { key: 'accessories', labelAr: 'ملحقات' },
    { key: 'home-tech', labelAr: 'أجهزة منزلية ذكية' },
  ],
  OFFICE: [
    { key: 'stationery', labelAr: 'قرطاسية' },
    { key: 'furniture', labelAr: 'أثاث مكتبي' },
    { key: 'printing', labelAr: 'مطبوعات' },
    { key: 'organizers', labelAr: 'منظّمات ومجلدات' },
  ],
  HANDICRAFT: [
    { key: 'pottery', labelAr: 'فخار وخزف' },
    { key: 'weaving', labelAr: 'سدو ومنسوجات' },
    { key: 'jewelry', labelAr: 'مجوهرات تراثية' },
    { key: 'silver', labelAr: 'فضيات' },
    { key: 'frankincense', labelAr: 'لبان وبخور' },
    { key: 'wood', labelAr: 'خشبيات' },
  ],
  DIGITAL: [
    { key: 'design', labelAr: 'تصميم جرافيك' },
    { key: 'web', labelAr: 'تطوير ويب' },
    { key: 'marketing', labelAr: 'تسويق رقمي' },
    { key: 'consulting', labelAr: 'استشارات' },
    { key: 'courses', labelAr: 'دورات وتدريب' },
    { key: 'subscriptions', labelAr: 'اشتراكات رقمية' },
  ],
  OTHER: [
    { key: 'general', labelAr: 'عام' },
    { key: 'gifts', labelAr: 'هدايا' },
    { key: 'home', labelAr: 'مستلزمات منزلية' },
    { key: 'health', labelAr: 'صحة وعناية' },
    { key: 'sports', labelAr: 'رياضة' },
  ],
}

export const ALL_SUBCATEGORY_KEYS = Object.values(SUBCATEGORIES)
  .flatMap((arr) => arr.map((s) => s.key))

export const subcategoryLabel = (categoryKey, subKey) => {
  if (!categoryKey || !subKey) return ''
  const list = SUBCATEGORIES[categoryKey] || []
  return list.find((s) => s.key === subKey)?.labelAr || subKey
}

export const CATEGORY_LABEL_BY_KEY = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.key, c.label])
)

export const categoryLabel = (k) => CATEGORY_LABEL_BY_KEY[k] || k || 'أخرى'
export const categoryEmoji = (k) =>
  PRODUCT_CATEGORIES.find((c) => c.key === k)?.emoji || '🛒'

// Platform commission: 5% of (subtotal before discount).
export const COMMISSION_PERCENT = 5

// COD (Cash on Delivery) extra fee in OMR — added on top of shipping.
export const COD_EXTRA_FEE_OMR = 0.5

// Shipping fees by governorate (OMR).
// Simplified policy: 2 OMR within Muscat, 3 OMR for all other governorates.
export const SHIPPING_FEES_OMR = {
  MUSCAT: 2.0,
  BATINAH: 3.0,
  DAKHILIYAH: 3.0,
  DHAHIRAH: 3.0,
  SHARQIYAH: 3.0,
  BURAIMI: 3.0,
  DHOFAR: 3.0,
  MUSANDAM: 3.0,
  WUSTA: 3.0,
}
export const DEFAULT_SHIPPING_FEE = 3.0
// Free shipping when the after-tier-discount amount reaches this threshold
export const FREE_SHIPPING_THRESHOLD = 30.0

export function computeShippingFee(governorate, amount = 0) {
  if (Number(amount) >= FREE_SHIPPING_THRESHOLD) return 0
  const key = String(governorate || '').toUpperCase()
  const fee = SHIPPING_FEES_OMR[key]
  return typeof fee === 'number' ? fee : DEFAULT_SHIPPING_FEE
}

export const ORDER_STATUS_LABELS = {
  PENDING: 'قيد الانتظار',
  PAID: 'مدفوع',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغي',
}

export const ORDER_STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
}

export const VENDOR_APP_STATUS_LABELS = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
}

export const VENDOR_APP_STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

// Tier discount percent from /lib/membership.js (mirrored for client use)
export const TIER_DISCOUNT_PERCENT = {
  FREE: 0,
  BASIC: 10,
  GOLD: 20,
  PLATINUM: 30,
}

export function formatOMR(amount) {
  const n = Number(amount || 0)
  return new Intl.NumberFormat('ar', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Compute cart totals.
 * - subtotal = sum(unit price * qty)
 * - discountPercent = tierDiscount[tier]
 * - discountAmount = subtotal * discountPercent/100
 * - commissionAmount = subtotal * 5/100 (on pre-discount subtotal)
 * - totalPaid = subtotal - discountAmount
 */
export function computeCartTotals({ items, tier = 'FREE' }) {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(it.unitPrice || 0) * Number(it.quantity || 0),
    0
  )
  const discountPercent = TIER_DISCOUNT_PERCENT[tier] || 0
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(3)
  const commissionAmount = +(subtotal * (COMMISSION_PERCENT / 100)).toFixed(3)
  const totalPaid = +(subtotal - discountAmount).toFixed(3)
  return {
    subtotal: +subtotal.toFixed(3),
    discountPercent,
    discountAmount,
    commissionPercent: COMMISSION_PERCENT,
    commissionAmount,
    totalPaid,
  }
}
