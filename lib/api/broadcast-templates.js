import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { BroadcastTemplate } from '@/lib/models'

const VALID_CATEGORIES = ['update', 'offer', 'reminder', 'welcome', 'event', 'other']

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: 'UNAUTHORIZED', status: 401 }
  if (session.user.role !== 'ADMIN') return { error: 'FORBIDDEN', status: 403 }
  return { session }
}

function serialize(t) {
  return {
    id: t._id,
    name: t.name,
    description: t.description || '',
    category: t.category || 'other',
    subject: t.subject,
    htmlBody: t.htmlBody,
    isActive: t.isActive !== false,
    usageCount: t.usageCount || 0,
    createdBy: t.createdBy || '',
    createdByName: t.createdByName || '',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

/** GET /api/admin/broadcast/templates → { items: [...] } */
export async function handleTemplatesList() {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const items = await BroadcastTemplate.find({ isActive: true })
    .sort({ updatedAt: -1 })
    .lean()
  return NextResponse.json({ items: items.map(serialize) })
}

/** POST /api/admin/broadcast/templates → create */
export async function handleTemplatesCreate(request) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const body = await request.json().catch(() => ({}))
  const {
    name,
    description = '',
    category = 'other',
    subject,
    htmlBody,
  } = body || {}

  if (!name || !name.trim())
    return NextResponse.json({ error: 'MISSING_NAME' }, { status: 400 })
  if (!subject || !subject.trim())
    return NextResponse.json({ error: 'MISSING_SUBJECT' }, { status: 400 })
  if (!htmlBody || !htmlBody.trim())
    return NextResponse.json({ error: 'MISSING_BODY' }, { status: 400 })

  const cat = VALID_CATEGORIES.includes(category) ? category : 'other'

  const doc = await BroadcastTemplate.create({
    name: name.trim().slice(0, 120),
    description: (description || '').trim().slice(0, 240),
    category: cat,
    subject: subject.trim(),
    htmlBody: htmlBody.trim(),
    isActive: true,
    createdBy: auth.session.user.id,
    createdByName: auth.session.user.name || auth.session.user.email || '',
  })

  return NextResponse.json({ item: serialize(doc) }, { status: 201 })
}

/** PUT /api/admin/broadcast/templates/:id → update */
export async function handleTemplatesUpdate(request, id) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const body = await request.json().catch(() => ({}))
  const patch = {}
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 120)
  if (typeof body.description === 'string')
    patch.description = body.description.trim().slice(0, 240)
  if (typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category))
    patch.category = body.category
  if (typeof body.subject === 'string' && body.subject.trim())
    patch.subject = body.subject.trim()
  if (typeof body.htmlBody === 'string' && body.htmlBody.trim())
    patch.htmlBody = body.htmlBody.trim()
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive

  const updated = await BroadcastTemplate.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
  if (!updated) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ item: serialize(updated) })
}

/** DELETE /api/admin/broadcast/templates/:id → soft delete (isActive=false) */
export async function handleTemplatesDelete(request, id) {
  const auth = await requireAdmin()
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectDB()
  const url = new URL(request.url)
  const hard = url.searchParams.get('hard') === '1'
  if (hard) {
    const r = await BroadcastTemplate.deleteOne({ _id: id })
    if (r.deletedCount === 0)
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ deleted: true, hard: true })
  }
  const updated = await BroadcastTemplate.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true }
  ).lean()
  if (!updated) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ deleted: true, hard: false })
}
