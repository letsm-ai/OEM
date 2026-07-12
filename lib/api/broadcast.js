import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, EmailOptOut, EmailBroadcast } from '@/lib/models'
import { sendBroadcastBatch } from '@/lib/email'

const VALID_TIERS = ['FREE', 'BASIC', 'GOLD', 'PLATINUM']
const VALID_ROLES = ['MEMBER', 'VENDOR', 'EXPERT', 'ADMIN']

/** Require admin session for all endpoints below. */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: 'UNAUTHORIZED', status: 401 }
  if (session.user.role !== 'ADMIN') return { error: 'FORBIDDEN', status: 403 }
  return { session }
}

/** Build a Mongo filter for target audience based on tiers/roles. */
function buildAudienceFilter({ tiers = [], roles = [], activeOnly = true }) {
  const filter = { email: { $exists: true, $ne: '' } }
  const cleanTiers = (tiers || []).filter((t) => VALID_TIERS.includes(t))
  const cleanRoles = (roles || []).filter((r) => VALID_ROLES.includes(r))
  if (cleanTiers.length > 0) filter.membershipTier = { $in: cleanTiers }
  if (cleanRoles.length > 0) filter.role = { $in: cleanRoles }
  if (activeOnly) filter.status = { $ne: 'SUSPENDED' }
  return filter
}

/**
 * POST /api/admin/broadcast/preview
 * Body: { tiers[], roles[], activeOnly }
 * Returns: { total, optedOut, deliverable }
 */
export async function handleBroadcastPreview(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const body = await request.json().catch(() => ({}))
  const filter = buildAudienceFilter(body)

  const users = await User.find(filter).select('email').lean()
  const emails = [
    ...new Set(
      users
        .map((u) => String(u.email || '').toLowerCase().trim())
        .filter(Boolean)
    ),
  ]

  let optedOutCount = 0
  if (emails.length > 0) {
    optedOutCount = await EmailOptOut.countDocuments({ email: { $in: emails } })
  }

  return NextResponse.json({
    total: emails.length,
    optedOut: optedOutCount,
    deliverable: Math.max(0, emails.length - optedOutCount),
  })
}

/**
 * POST /api/admin/broadcast/send
 * Body: { subject, htmlBody, tiers[], roles[], activeOnly, sendAsPlain? }
 * Sends the campaign, records the run in EmailBroadcast, returns stats.
 * Runs synchronously — for very large audiences (>500) prefer batching.
 */
export async function handleBroadcastSend(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const body = await request.json().catch(() => ({}))
  const {
    subject,
    htmlBody,
    tiers = [],
    roles = [],
    activeOnly = true,
  } = body || {}

  if (!subject || !subject.trim()) {
    return NextResponse.json({ error: 'MISSING_SUBJECT' }, { status: 400 })
  }
  if (!htmlBody || !htmlBody.trim()) {
    return NextResponse.json({ error: 'MISSING_BODY' }, { status: 400 })
  }
  if ((tiers?.length || 0) === 0 && (roles?.length || 0) === 0) {
    return NextResponse.json(
      { error: 'MISSING_TARGET', message: 'اختر باقة واحدة أو دور واحد على الأقل' },
      { status: 400 }
    )
  }

  const filter = buildAudienceFilter({ tiers, roles, activeOnly })
  const users = await User.find(filter).select('email name').lean()
  const uniqueEmails = new Map()
  for (const u of users) {
    const e = String(u.email || '').toLowerCase().trim()
    if (e && !uniqueEmails.has(e)) uniqueEmails.set(e, u.name || '')
  }
  const recipients = [...uniqueEmails.entries()]

  // Create campaign record first so we have a stable id for audit
  const record = await EmailBroadcast.create({
    subject: subject.trim(),
    htmlBody: htmlBody.trim(),
    tiers: (tiers || []).filter((t) => VALID_TIERS.includes(t)),
    roles: (roles || []).filter((r) => VALID_ROLES.includes(r)),
    activeOnly: !!activeOnly,
    totalRecipients: recipients.length,
    status: 'SENDING',
    sentBy: auth.session.user.id,
    sentByName: auth.session.user.name || auth.session.user.email || '',
    sentAt: new Date(),
  })

  let successCount = 0
  let failCount = 0
  let optedOutSkipped = 0
  const errorSamples = [] // first 5 error messages for diagnostics

  // ---- Use Resend Batch API (bypasses per-second rate limits) ----
  // Sends up to 100 emails per HTTP request. Personalized subject + unsub token
  // per recipient are built inside sendBroadcastBatch.
  try {
    const batchResult = await sendBroadcastBatch(
      recipients.map(([email, name]) => ({ email, name })),
      { subject: subject.trim(), htmlBody: htmlBody.trim() }
    )
    successCount = batchResult.sent
    failCount = batchResult.failed
    optedOutSkipped = batchResult.skipped
    for (const err of batchResult.errors || []) {
      if (errorSamples.length < 5) errorSamples.push(err)
    }
    // Also surface first few per-recipient errors so admin sees exact rejection reasons
    for (const pr of batchResult.perRecipient || []) {
      if (pr.status === 'FAILED' && pr.error && errorSamples.length < 5) {
        errorSamples.push(`${pr.email}: ${String(pr.error).slice(0, 200)}`)
      }
    }
  } catch (e) {
    console.error('[broadcast] batch send failed entirely:', e?.message)
    failCount = recipients.length
    errorSamples.push(`batch: ${String(e?.message || e).slice(0, 300)}`)
  }

  const finalStatus = failCount === 0 ? 'COMPLETED' : failCount === recipients.length ? 'FAILED' : 'COMPLETED'
  await EmailBroadcast.updateOne(
    { _id: record._id },
    {
      $set: {
        successCount,
        failCount,
        optedOutSkipped,
        status: finalStatus,
        error: errorSamples.join(' | ').slice(0, 1000),
      },
    }
  )

  return NextResponse.json({
    id: record._id,
    totalRecipients: recipients.length,
    successCount,
    failCount,
    optedOutSkipped,
    status: finalStatus,
    error: errorSamples.join(' | ').slice(0, 1000) || undefined,
  })
}

/**
 * GET /api/admin/broadcast/history?limit=50
 * Returns recent broadcasts (newest first).
 */
export async function handleBroadcastHistory(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const url = new URL(request.url)
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10))

  const items = await EmailBroadcast.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json({
    items: items.map((b) => ({
      id: b._id,
      subject: b.subject,
      tiers: b.tiers || [],
      roles: b.roles || [],
      activeOnly: !!b.activeOnly,
      totalRecipients: b.totalRecipients || 0,
      successCount: b.successCount || 0,
      failCount: b.failCount || 0,
      optedOutSkipped: b.optedOutSkipped || 0,
      status: b.status,
      error: b.error || '',
      sentBy: b.sentBy || '',
      sentByName: b.sentByName || '',
      sentAt: b.sentAt,
      createdAt: b.createdAt,
    })),
  })
}
