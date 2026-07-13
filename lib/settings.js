/**
 * Runtime settings helper — reads the SiteSettings singleton from MongoDB
 * with a short in-process cache so we don't hit the DB on every request.
 *
 * All membership/price/duration/free-mode/trial decisions in the app
 * should route through this module instead of hard-coded constants.
 */
import { connectDB } from '@/lib/db'
import { SiteSettings } from '@/lib/models'

const DEFAULTS = Object.freeze({
  tierPrices: { BASIC: 50, GOLD: 100, PLATINUM: 200 },
  tierDiscounts: { BASIC: 5, GOLD: 12, PLATINUM: 20 },
  membershipDurationDays: 365,
  trial: { enabled: true, durationDays: 30, allowedTier: '' },
  freeMode: {
    enabled: false,
    startDate: null,
    endDate: null,
    includedTiers: ['BASIC', 'GOLD', 'PLATINUM'],
    bannerAr: '',
    bannerEn: '',
  },
  codFeeOmr: 1,
  supportEmail: 'support@omanimajles.com',
  supportWhatsapp: '',
})

let _cache = null
let _cacheAt = 0
const CACHE_TTL_MS = 30_000 // 30 seconds

/** Force the next getSettings() call to hit the DB (call after PATCH). */
export function invalidateSettings() {
  _cache = null
  _cacheAt = 0
}

/**
 * Fetch the singleton settings row (creating it with defaults if missing).
 * Cached for 30s to keep hot paths fast.
 */
export async function getSettings({ fresh = false } = {}) {
  const now = Date.now()
  if (!fresh && _cache && now - _cacheAt < CACHE_TTL_MS) {
    return _cache
  }
  try {
    await connectDB()
    let doc = await SiteSettings.findById('default').lean()
    if (!doc) {
      const created = await SiteSettings.create({ _id: 'default' })
      doc = created.toObject()
    }
    _cache = { ...DEFAULTS, ...doc, _id: undefined }
    _cacheAt = now
    return _cache
  } catch (e) {
    console.error('[settings] fetch failed, using defaults:', e?.message)
    return { ...DEFAULTS }
  }
}

/** Is the global "everything free" mode active RIGHT NOW? */
export async function isFreeModeActive() {
  const s = await getSettings()
  if (!s.freeMode?.enabled) return false
  const now = new Date()
  const start = s.freeMode.startDate ? new Date(s.freeMode.startDate) : null
  const end = s.freeMode.endDate ? new Date(s.freeMode.endDate) : null
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

/**
 * Compute the effective price (OMR) for a tier.
 * Returns 0 if free-mode is active AND the tier is included in freeMode.includedTiers.
 * Otherwise returns the admin-configured price (or default).
 */
export async function getEffectivePrice(tier) {
  if (tier === 'FREE') return 0
  const s = await getSettings()
  const listed = s.tierPrices?.[tier] ?? DEFAULTS.tierPrices[tier] ?? 0
  const freeActive = await isFreeModeActive()
  if (freeActive && s.freeMode.includedTiers.includes(tier)) return 0
  return listed
}

export async function getEffectiveDiscount(tier) {
  if (tier === 'FREE') return 0
  const s = await getSettings()
  return s.tierDiscounts?.[tier] ?? DEFAULTS.tierDiscounts[tier] ?? 0
}

export async function getMembershipDurationDays() {
  const s = await getSettings()
  return Number(s.membershipDurationDays) || DEFAULTS.membershipDurationDays
}

/** Add N days to `from` (default now) and return a Date. */
export function daysFromNow(days, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + Math.max(1, Number(days) || 1))
  return d
}

/** Convenience: build the endDate for a new PAID subscription. */
export async function subscriptionEndDate(from = new Date()) {
  return daysFromNow(await getMembershipDurationDays(), from)
}

/** Trial policy for signup / dashboard opt-in. */
export async function getTrialPolicy() {
  const s = await getSettings()
  return s.trial || DEFAULTS.trial
}

export { DEFAULTS as SETTINGS_DEFAULTS }
