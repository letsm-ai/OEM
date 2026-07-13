import { NextResponse } from 'next/server'
import { getSettings, isFreeModeActive } from '@/lib/settings'
import { withCORS, optionsResponse } from '@/lib/api/_cors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS() {
  return optionsResponse()
}

/**
 * GET /api/settings/public
 * Returns non-sensitive settings safe for anonymous clients:
 *   - tierPrices    (BASIC/GOLD/PLATINUM prices in OMR)
 *   - tierDiscounts (percent discount by tier)
 *   - trial         (enabled, durationDays, allowedTier)
 *   - freeMode      (enabled, bannerAr/En, includedTiers) — client can highlight promo
 *   - codFeeOmr
 * Does NOT expose API keys, secrets, or admin-only settings.
 */
export async function GET() {
  try {
    const s = await getSettings()
    const freeActive = await isFreeModeActive()
    return withCORS(
      NextResponse.json({
        tierPrices: s.tierPrices || {},
        tierDiscounts: s.tierDiscounts || {},
        trial: s.trial || { enabled: false, durationDays: 30, allowedTier: '' },
        freeMode: {
          enabled: !!s.freeMode?.enabled,
          active: !!freeActive,
          bannerAr: s.freeMode?.bannerAr || '',
          bannerEn: s.freeMode?.bannerEn || '',
          includedTiers: s.freeMode?.includedTiers || [],
        },
        codFeeOmr: s.codFeeOmr || 0,
        membershipDurationDays: s.membershipDurationDays || 365,
      })
    )
  } catch (e) {
    console.error('[settings/public] failed:', e?.message)
    return withCORS(
      NextResponse.json(
        { error: 'FAILED', message: e?.message || 'unknown' },
        { status: 500 }
      )
    )
  }
}
