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
    nameEn: 'Free',
    price: 0,
    tagline: 'ابدأ الاستكشاف',
    taglineEn: 'Start exploring',
    color: 'gray',
    gradient: 'from-gray-100 to-gray-50',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-700',
    benefits: [
      'تصفح دليل الشركات',
      'حضور الفعاليات العامة',
    ],
    benefitsEn: [
      'Browse the business directory',
      'Attend public events',
    ],
    limits: [
      'لا يمكن إضافة شركتك للدليل',
      'لا يمكن فتح متجر بائع',
      'لا توجد خصومات',
    ],
    limitsEn: [
      'Cannot list your company in the directory',
      'Cannot open a vendor store',
      'No discounts',
    ],
  },
  BASIC: {
    key: 'BASIC',
    nameAr: 'أساسي',
    nameEn: 'Basic',
    price: 50,
    tagline: 'ابدأ حضورك الرقمي',
    taglineEn: 'Kick off your digital presence',
    color: 'blue',
    gradient: 'from-blue-50 to-white',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
    benefits: [
      'جميع مزايا الباقة المجانية',
      'إضافة شركتك إلى دليل الشركات',
      'خصم 5% على الاستشارات',
      'خصم 5% على مشتريات المتجر',
    ],
    benefitsEn: [
      'All Free tier benefits',
      'List your company in the directory',
      '5% discount on consultations',
      '5% discount on store purchases',
    ],
  },
  GOLD: {
    key: 'GOLD',
    nameAr: 'ذهبي',
    nameEn: 'Gold',
    price: 100,
    tagline: 'الأكثر شعبية',
    taglineEn: 'Most popular',
    popular: true,
    color: 'gold',
    gradient: 'from-[#C9A84C]/10 to-white',
    borderClass: 'border-[#C9A84C]',
    textClass: 'text-[#8a6f2d]',
    benefits: [
      'جميع مزايا الباقة الأساسية',
      'فتح متجر بائع خاص بك',
      'خصم 12% على الاستشارات',
      'شركتك مميّزة في دليل الشركات',
      'أولوية لحضور الفعاليات والورش',
    ],
    benefitsEn: [
      'All Basic tier benefits',
      'Open your own vendor store',
      '12% discount on consultations',
      'Featured company in the directory',
      'Priority access to events and workshops',
    ],
  },
  PLATINUM: {
    key: 'PLATINUM',
    nameAr: 'بلاتيني',
    nameEn: 'Platinum',
    price: 200,
    tagline: 'تجربة حصرية',
    taglineEn: 'Exclusive experience',
    color: 'purple',
    gradient: 'from-purple-50 to-white',
    borderClass: 'border-purple-300',
    textClass: 'text-purple-700',
    benefits: [
      'جميع مزايا الباقة الذهبية',
      'جلسة استشارية مجانية شهرياً',
      'خصم 20% على المعارض والفعاليات',
      'تواصل مباشر مع مسؤولين وصناع قرار',
      'دعم فني مخصص وأولوية قصوى',
    ],
    benefitsEn: [
      'All Gold tier benefits',
      'One free consultation session per month',
      '20% discount on exhibitions & events',
      'Direct access to officials & decision-makers',
      'Dedicated support with highest priority',
    ],
  },
}

/** Discount % applied to store purchases & consultations by tier */
export const TIER_DISCOUNT = {
  FREE: 0,
  BASIC: 5,
  GOLD: 12,
  PLATINUM: 20,
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

/** Locale-aware date formatter (ar / en) */
export function formatLocaleDate(date, lang = 'ar') {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
