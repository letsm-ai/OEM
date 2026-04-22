/**
 * Membership tier metadata, permissions & discounts.
 * Used by both server (API) and client (UI).
 */

export const TIERS = ['FREE', 'BASIC', 'GOLD', 'PLATINUM']

export const TIER_ORDER = {
  FREE: 0,
  BASIC: 1,
  GOLD: 2,
  PLATINUM: 3,
}

export const TIER_META = {
  FREE: {
    key: 'FREE',
    nameAr: 'مجاني',
    price: 0,
    tagline: 'ابدأ الاستكشاف',
    color: 'gray',
    gradient: 'from-gray-100 to-gray-50',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-700',
    benefits: [
      'تصفح دليل الشركات',
      'حضور الفعاليات العامة',
    ],
    limits: [
      'لا يمكن إضافة شركتك للدليل',
      'لا يمكن فتح متجر بائع',
      'لا توجد خصومات',
    ],
  },
  BASIC: {
    key: 'BASIC',
    nameAr: 'أساسي',
    price: 50,
    tagline: 'ابدأ حضورك الرقمي',
    color: 'blue',
    gradient: 'from-blue-50 to-white',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
    benefits: [
      'جميع مزايا الباقة المجانية',
      'إضافة شركتك إلى دليل الشركات',
      'خصم 10% على الاستشارات',
      'خصم 10% على مشتريات المتجر',
    ],
  },
  GOLD: {
    key: 'GOLD',
    nameAr: 'ذهبي',
    price: 100,
    tagline: 'الأكثر شعبية',
    popular: true,
    color: 'gold',
    gradient: 'from-[#C9A84C]/10 to-white',
    borderClass: 'border-[#C9A84C]',
    textClass: 'text-[#8a6f2d]',
    benefits: [
      'جميع مزايا الباقة الأساسية',
      'فتح متجر بائع خاص بك',
      'خصم 20% على الاستشارات',
      'شركتك مميّزة في دليل الشركات',
      'أولوية لحضور الفعاليات والورش',
    ],
  },
  PLATINUM: {
    key: 'PLATINUM',
    nameAr: 'بلاتيني',
    price: 200,
    tagline: 'تجربة حصرية',
    color: 'purple',
    gradient: 'from-purple-50 to-white',
    borderClass: 'border-purple-300',
    textClass: 'text-purple-700',
    benefits: [
      'جميع مزايا الباقة الذهبية',
      'جلسة استشارية مجانية شهرياً',
      'خصم 30% على المعارض والفعاليات',
      'تواصل مباشر مع مسؤولين وصناع قرار',
      'دعم فني مخصص وأولوية قصوى',
    ],
  },
}

/** Discount % applied to store purchases & consultations by tier */
export const TIER_DISCOUNT = {
  FREE: 0,
  BASIC: 10,
  GOLD: 20,
  PLATINUM: 30,
}

/** Tier required to open a vendor store */
export const VENDOR_MIN_TIER = 'GOLD'
/** Tier required to list a company in the directory */
export const DIRECTORY_MIN_TIER = 'BASIC'

export function tierAtLeast(userTier, minTier) {
  return (TIER_ORDER[userTier] ?? -1) >= (TIER_ORDER[minTier] ?? 0)
}

export function getDiscountPercent(tier) {
  return TIER_DISCOUNT[tier] ?? 0
}

/** Apply the user's tier discount to a price (OMR). Returns { finalPrice, discount } */
export function applyDiscount(price, tier) {
  const pct = getDiscountPercent(tier)
  const discount = (price * pct) / 100
  return {
    originalPrice: price,
    discountPercent: pct,
    discountAmount: Number(discount.toFixed(3)),
    finalPrice: Number((price - discount).toFixed(3)),
  }
}

export function canBeVendor(tier) {
  return tierAtLeast(tier, VENDOR_MIN_TIER)
}

export function canListCompany(tier) {
  return tierAtLeast(tier, DIRECTORY_MIN_TIER)
}

/** Date 1 year from now (for new subscriptions) */
export function oneYearFromNow(from = new Date()) {
  const d = new Date(from)
  d.setFullYear(d.getFullYear() + 1)
  return d
}

/** Friendly Arabic date formatter */
export function formatArabicDate(date) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('ar', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
