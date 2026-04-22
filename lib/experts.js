export const SPECIALTIES = [
  { key: 'LEGAL', nameAr: 'استشارات قانونية', emoji: '⚖️' },
  { key: 'FINANCIAL', nameAr: 'استشارات مالية ومحاسبية', emoji: '💰' },
  { key: 'MARKETING', nameAr: 'استشارات تسويقية', emoji: '📢' },
  { key: 'TECH', nameAr: 'استشارات تقنية', emoji: '💻' },
  { key: 'MANAGEMENT', nameAr: 'استشارات إدارية', emoji: '🎯' },
  { key: 'HR', nameAr: 'استشارات موارد بشرية', emoji: '👥' },
]

export const SPECIALTY_KEYS = SPECIALTIES.map((s) => s.key)
export const SPECIALTY_MAP = Object.fromEntries(
  SPECIALTIES.map((s) => [s.key, s])
)
export function specialtyLabel(key) {
  return SPECIALTY_MAP[key]?.nameAr || key
}

export const DAY_NAMES_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
]

/** HH:mm math helpers */
function toMinutes(hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number)
  return h * 60 + (m || 0)
}
function toHHmm(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Given weekly availability ranges for a given day-of-week, produce one-hour slots.
 * availability: [{ startTime: 'HH:mm', endTime: 'HH:mm' }]
 * Returns: [{ startTime, endTime }]
 */
export function generateHourlySlots(availability = []) {
  const slots = []
  for (const range of availability) {
    const s = toMinutes(range.startTime)
    const e = toMinutes(range.endTime)
    for (let m = s; m + 60 <= e; m += 60) {
      slots.push({ startTime: toHHmm(m), endTime: toHHmm(m + 60) })
    }
  }
  return slots
}

export function dateKey(d) {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getUTCFullYear()
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dt.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Apply user tier discount percent */
export function computeSessionPrice(hourlyRate, discountPercent) {
  const pct = Number(discountPercent) || 0
  const discount = (hourlyRate * pct) / 100
  return {
    originalPrice: Number(hourlyRate.toFixed(3)),
    discountPercent: pct,
    discountAmount: Number(discount.toFixed(3)),
    finalPrice: Number((hourlyRate - discount).toFixed(3)),
  }
}
