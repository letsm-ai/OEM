/**
 * Admin site-settings endpoints.
 *   GET   /api/admin/settings
 *   PATCH /api/admin/settings
 *
 * The settings row is a singleton (_id='default').
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SiteSettings } from '@/lib/models'
import { invalidateSettings, SETTINGS_DEFAULTS } from '@/lib/settings'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: 'auth', status: 401 }
  if (session.user.role !== 'ADMIN')
    return { error: 'forbidden', status: 403 }
  return { session }
}

export async function handleAdminSettingsGet() {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status }
    )
  }
  await connectDB()
  let doc = await SiteSettings.findById('default').lean()
  if (!doc) {
    doc = (await SiteSettings.create({ _id: 'default' })).toObject()
  }
  // Merge with defaults for any missing keys (schema evolution safety)
  const settings = { ...SETTINGS_DEFAULTS, ...doc }
  delete settings._id
  return NextResponse.json({ settings })
}

/**
 * PATCH — partial update. Only well-known keys are accepted, validated,
 * and merged onto the singleton.
 */
export async function handleAdminSettingsPatch(request) {
  const guard = await requireAdmin()
  if (guard.error) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status }
    )
  }
  const body = await request.json().catch(() => ({}))
  const set = {}

  // ---- tierPrices ----
  if (body.tierPrices && typeof body.tierPrices === 'object') {
    for (const k of ['BASIC', 'GOLD', 'PLATINUM']) {
      const v = Number(body.tierPrices[k])
      if (Number.isFinite(v) && v >= 0) {
        set[`tierPrices.${k}`] = v
      }
    }
  }

  // ---- tierDiscounts ----
  if (body.tierDiscounts && typeof body.tierDiscounts === 'object') {
    for (const k of ['BASIC', 'GOLD', 'PLATINUM']) {
      const v = Number(body.tierDiscounts[k])
      if (Number.isFinite(v) && v >= 0 && v <= 100) {
        set[`tierDiscounts.${k}`] = v
      }
    }
  }

  // ---- membershipDurationDays ----
  if (body.membershipDurationDays !== undefined) {
    const v = Math.max(1, parseInt(body.membershipDurationDays, 10))
    if (Number.isFinite(v)) set.membershipDurationDays = v
  }

  // ---- trial ----
  if (body.trial && typeof body.trial === 'object') {
    if (body.trial.enabled !== undefined) {
      set['trial.enabled'] = !!body.trial.enabled
    }
    if (body.trial.durationDays !== undefined) {
      const v = Math.max(1, parseInt(body.trial.durationDays, 10))
      if (Number.isFinite(v)) set['trial.durationDays'] = v
    }
    if (body.trial.allowedTier !== undefined) {
      const t = String(body.trial.allowedTier || '').toUpperCase()
      if (['', 'BASIC', 'GOLD', 'PLATINUM'].includes(t)) {
        set['trial.allowedTier'] = t
      }
    }
  }

  // ---- freeMode ----
  if (body.freeMode && typeof body.freeMode === 'object') {
    if (body.freeMode.enabled !== undefined) {
      set['freeMode.enabled'] = !!body.freeMode.enabled
    }
    if (body.freeMode.startDate !== undefined) {
      const d = body.freeMode.startDate ? new Date(body.freeMode.startDate) : null
      set['freeMode.startDate'] = d && !isNaN(d.getTime()) ? d : null
    }
    if (body.freeMode.endDate !== undefined) {
      const d = body.freeMode.endDate ? new Date(body.freeMode.endDate) : null
      set['freeMode.endDate'] = d && !isNaN(d.getTime()) ? d : null
    }
    if (Array.isArray(body.freeMode.includedTiers)) {
      const clean = body.freeMode.includedTiers
        .map((t) => String(t).toUpperCase())
        .filter((t) => ['BASIC', 'GOLD', 'PLATINUM'].includes(t))
      set['freeMode.includedTiers'] = [...new Set(clean)]
    }
    if (body.freeMode.bannerAr !== undefined) {
      set['freeMode.bannerAr'] = String(body.freeMode.bannerAr || '').slice(0, 300)
    }
    if (body.freeMode.bannerEn !== undefined) {
      set['freeMode.bannerEn'] = String(body.freeMode.bannerEn || '').slice(0, 300)
    }
  }

  // ---- codFeeOmr ----
  if (body.codFeeOmr !== undefined) {
    const v = Number(body.codFeeOmr)
    if (Number.isFinite(v) && v >= 0) set.codFeeOmr = v
  }

  // ---- support ----
  if (body.supportEmail !== undefined) {
    set.supportEmail = String(body.supportEmail || '').trim().slice(0, 100)
  }
  if (body.supportWhatsapp !== undefined) {
    set.supportWhatsapp = String(body.supportWhatsapp || '').trim().slice(0, 40)
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }
  set.updatedBy = guard.session.user.email || guard.session.user.id

  await connectDB()
  await SiteSettings.updateOne(
    { _id: 'default' },
    { $set: set },
    { upsert: true }
  )
  invalidateSettings()

  const doc = await SiteSettings.findById('default').lean()
  const settings = { ...SETTINGS_DEFAULTS, ...doc }
  delete settings._id
  return NextResponse.json({ success: true, settings })
}
