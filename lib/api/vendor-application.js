/**
 * Vendor application + admin approval endpoints.
 *   GET  /vendor/application
 *   POST /vendor/apply                          (open to all tiers)
 *   GET  /admin/vendor-applications?status=     (admin)
 *   POST /admin/vendor-applications/:id/approve (admin)
 *   POST /admin/vendor-applications/:id/reject  (admin)
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, VendorApplication } from '@/lib/models'
import { VENDOR_AGREEMENT_VERSION } from '@/lib/vendor-agreement'
import { uniqueVendorSlug } from '@/lib/slug'
import { json, err, requireAuth, requireRole } from './_helpers'

export async function handleVendorApplicationGet() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const app = await VendorApplication.findOne({ userId: session.user.id }).lean()
  const user = await User.findById(session.user.id).lean()
  return json({
    application: app ? { id: app._id, ...app, _id: undefined } : null,
    isVendor: user?.role === 'VENDOR' || user?.role === 'ADMIN',
    tier: user?.membershipTier || 'FREE',
  })
}

export async function handleVendorApply(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser) return err('المستخدم غير موجود', 404)
  if (dbUser.role === 'VENDOR' || dbUser.role === 'ADMIN') {
    return err('أنت بائع بالفعل', 400)
  }
  const body = await request.json().catch(() => ({}))
  const businessName = String(body?.businessName || '').trim()
  if (!businessName || businessName.length < 2) {
    return err('اسم المتجر/النشاط مطلوب', 400)
  }

  // ---- Mandatory vendor onboarding contract ----
  if (body.agreementAccepted !== true) {
    return err(
      'يجب الموافقة على عقد البائع قبل التسجيل. الرجاء قراءة البنود والموافقة عليها.',
      400
    )
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    ''

  const existing = await VendorApplication.findOne({ userId: session.user.id })
  if (existing && existing.status === 'PENDING') {
    return err('لديك طلب قيد المراجعة بالفعل', 409)
  }
  const doc = {
    userId: session.user.id,
    businessName,
    businessDescription: String(body?.businessDescription || '').slice(0, 2000),
    phone: String(body?.phone || '').slice(0, 30),
    status: 'PENDING',
    adminNote: '',
    reviewedBy: null,
    reviewedAt: null,
    agreementAccepted: true,
    agreementVersion: VENDOR_AGREEMENT_VERSION,
    agreementAcceptedAt: new Date(),
    agreementIp: ip,
    updatedAt: new Date(),
  }
  let saved
  if (existing) {
    saved = await VendorApplication.findByIdAndUpdate(
      existing._id,
      { $set: doc },
      { new: true }
    ).lean()
  } else {
    saved = (
      await VendorApplication.create({ ...doc, createdAt: new Date() })
    ).toObject()
  }
  return json({
    success: true,
    application: { id: saved._id, ...saved, _id: undefined },
  })
}

export async function handleAdminVendorApplicationsList(request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const url = new URL(request.url)
  const statusFilter = (url.searchParams.get('status') || '').toUpperCase()
  const q = {}
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
    q.status = statusFilter
  }
  const apps = await VendorApplication.find(q)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()
  const userIds = apps.map((a) => a.userId)
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, name: 1, email: 1, membershipTier: 1, role: 1 })
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
  return json({
    applications: apps.map((a) => ({
      id: a._id,
      ...a,
      _id: undefined,
      user: userMap[a.userId]
        ? {
            id: userMap[a.userId]._id,
            name: userMap[a.userId].name,
            email: userMap[a.userId].email,
            membershipTier: userMap[a.userId].membershipTier,
            role: userMap[a.userId].role,
          }
        : null,
    })),
  })
}

export async function handleAdminVendorApplicationAction(id, action, request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  const body = await request.json().catch(() => ({}))
  await connectDB()
  const app = await VendorApplication.findById(id)
  if (!app) return err('الطلب غير موجود', 404)
  app.status = action === 'approve' ? 'APPROVED' : 'REJECTED'
  app.adminNote = String(body?.note || '').slice(0, 500)
  app.reviewedBy = session.user.id
  app.reviewedAt = new Date()
  app.updatedAt = new Date()
  await app.save()
  if (action === 'approve') {
    const approvedUser = await User.findById(app.userId)
    if (approvedUser) {
      const existingSlug = approvedUser.vendorProfile?.slug
      let slug = existingSlug
      if (!slug) {
        slug = await uniqueVendorSlug(User, app.businessName, approvedUser._id)
      }
      approvedUser.role = 'VENDOR'
      approvedUser.vendorProfile = {
        slug,
        businessName: app.businessName || approvedUser.name,
        tagline: approvedUser.vendorProfile?.tagline || '',
        bio: approvedUser.vendorProfile?.bio || app.businessDescription || '',
        banner: approvedUser.vendorProfile?.banner || '',
        logo: approvedUser.vendorProfile?.logo || approvedUser.photo || '',
        phone: approvedUser.vendorProfile?.phone || app.phone || approvedUser.phone || '',
        whatsapp: approvedUser.vendorProfile?.whatsapp || '',
        instagram: approvedUser.vendorProfile?.instagram || '',
        website: approvedUser.vendorProfile?.website || '',
        governorate: approvedUser.vendorProfile?.governorate || '',
        city: approvedUser.vendorProfile?.city || '',
        address: approvedUser.vendorProfile?.address || '',
      }
      await approvedUser.save()
    }
  }
  return json({
    success: true,
    application: { id: app._id, ...app.toObject(), _id: undefined },
  })
}
