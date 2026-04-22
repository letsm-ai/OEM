/**
 * Sector & Governorate metadata for the Business Directory.
 * Enum keys mirror the Company schema.
 */

export const SECTORS = [
  { key: 'TECH', nameAr: 'التكنولوجيا والبرمجيات', emoji: '💻' },
  { key: 'MARKETING', nameAr: 'التسويق والإعلام', emoji: '📢' },
  { key: 'CONSULTING', nameAr: 'الاستشارات والتدريب', emoji: '📊' },
  { key: 'FOOD', nameAr: 'الغذاء والضيافة', emoji: '🍽️' },
  { key: 'INDUSTRY', nameAr: 'الصناعة والتصنيع', emoji: '🏭' },
  { key: 'TRADE', nameAr: 'التجارة والتوزيع', emoji: '📦' },
  { key: 'HEALTH', nameAr: 'الصحة والجمال', emoji: '🏥' },
  { key: 'EDUCATION', nameAr: 'التعليم والتطوير', emoji: '🎓' },
  { key: 'REAL_ESTATE', nameAr: 'العقارات والبناء', emoji: '🏗️' },
  { key: 'SERVICES', nameAr: 'الخدمات المهنية', emoji: '💼' },
]

export const SECTOR_KEYS = SECTORS.map((s) => s.key)

export const SECTOR_MAP = Object.fromEntries(SECTORS.map((s) => [s.key, s]))

export function sectorLabel(key) {
  return SECTOR_MAP[key]?.nameAr || key
}

export const GOVERNORATES = [
  { key: 'MUSCAT', nameAr: 'مسقط' },
  { key: 'DHOFAR', nameAr: 'ظفار' },
  { key: 'MUSANDAM', nameAr: 'مسندم' },
  { key: 'BURAIMI', nameAr: 'البريمي' },
  { key: 'DAKHILIYAH', nameAr: 'الداخلية' },
  { key: 'SHARQIYAH', nameAr: 'الشرقية' },
  { key: 'WUSTA', nameAr: 'الوسطى' },
  { key: 'BATINAH', nameAr: 'الباطنة' },
  { key: 'DHAHIRAH', nameAr: 'الظاهرة' },
]

export const GOVERNORATE_KEYS = GOVERNORATES.map((g) => g.key)

export const GOVERNORATE_MAP = Object.fromEntries(
  GOVERNORATES.map((g) => [g.key, g])
)

export function governorateLabel(key) {
  return GOVERNORATE_MAP[key]?.nameAr || key || ''
}

export const STATUS_LABELS = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'معتمدة',
  REJECTED: 'مرفوضة',
}

export const STATUS_BADGE = {
  PENDING: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border border-red-200',
}
