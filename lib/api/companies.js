/**
 * Companies / Directory endpoints.
 *   GET    /companies
 *   POST   /companies                 (auth + BASIC+)
 *   GET    /companies/:id
 *   PUT    /companies/:id              (owner / admin)
 *   DELETE /companies/:id              (owner / admin)
 *   GET    /my-companies
 *   GET    /admin/companies?status=    (admin)
 *   POST   /admin/companies/:id/approve (admin)
 *   POST   /admin/companies/:id/reject  (admin)
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Company, User } from '@/lib/models'
import { canListCompany } from '@/lib/membership'
import { SECTOR_KEYS, GOVERNORATE_KEYS } from '@/lib/directory'
import { sanitizeSocial } from '@/lib/social'
import { json, err, requireAuth, requireRole } from './_helpers'

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { nameAr: 1 },
  name_desc: { nameAr: -1 },
}

// ---------- Public list ----------
export async function handleCompaniesList(request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('search') || '').trim()
  const sector = url.searchParams.get('sector') || ''
  const gov = url.searchParams.get('governorate') || ''
  const sortParam = (url.searchParams.get('sort') || 'newest').toLowerCase()
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1),
    500
  )
  await connectDB()
  const query = { status: 'APPROVED' }
  if (sector) query.sector = sector
  if (gov) query.governorate = gov
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [
      { nameAr: rx },
      { nameEn: rx },
      { description: rx },
      { services: rx },
      { location: rx },
    ]
  }
  const sort = SORT_MAP[sortParam] || SORT_MAP.newest
  const list = await Company.find(query).sort(sort).limit(limit).lean()
  return json({
    companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
  })
}

// ---------- Create ----------
export async function handleCompanyCreate(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  const userTier = dbUser?.membershipTier || 'FREE'
  if (!canListCompany(userTier)) {
    return err('تحتاج إلى باقة أساسية أو أعلى لإضافة شركة', 403)
  }
  const body = await request.json().catch(() => ({}))
  const { nameAr, sector } = body || {}
  if (!nameAr || !sector) return err('اسم الشركة (عربي) والقطاع مطلوبان', 400)
  if (!SECTOR_KEYS.includes(sector)) return err('القطاع غير صحيح', 400)
  if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
    return err('المحافظة غير صحيحة', 400)
  }

  let latVal = null
  let lngVal = null
  if (body.lat !== undefined && body.lat !== null && body.lat !== '') {
    latVal = Number(body.lat)
    lngVal = Number(body.lng)
    if (
      !Number.isFinite(latVal) ||
      !Number.isFinite(lngVal) ||
      latVal < 16.6 || latVal > 27.0 ||
      lngVal < 51.5 || lngVal > 60.0
    ) {
      return err('الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)', 400)
    }
  }

  const company = await Company.create({
    userId: session.user.id,
    nameAr: String(nameAr).trim(),
    nameEn: body.nameEn ? String(body.nameEn).trim() : undefined,
    sector,
    governorate: body.governorate || undefined,
    description: body.description || '',
    services: Array.isArray(body.services) ? body.services.slice(0, 30) : [],
    phone: body.phone || '',
    email: body.email || '',
    website: body.website || '',
    social: sanitizeSocial(body.social),
    location: body.location || '',
    lat: latVal,
    lng: lngVal,
    logo: body.logo || '',
    status: 'PENDING',
    isApproved: false,
  })
  // Workaround for schema status not always persisting on .create
  await Company.findByIdAndUpdate(company._id, {
    status: 'PENDING',
    isApproved: false,
    lat: latVal,
    lng: lngVal,
  })
  const companyObj = company.toObject()
  return json({
    success: true,
    company: {
      id: company._id,
      ...companyObj,
      _id: undefined,
      status: companyObj.status || 'PENDING',
      isApproved: companyObj.isApproved || false,
    },
  })
}

// ---------- Get one ----------
export async function handleCompanyDetail(id) {
  await connectDB()
  const company = await Company.findById(id).lean()
  if (!company) return err('الشركة غير موجودة', 404)
  if (company.status !== 'APPROVED') {
    const session = await getServerSession(authOptions)
    const isOwner = session?.user?.id === company.userId
    const isAdmin = session?.user?.role === 'ADMIN'
    if (!isOwner && !isAdmin) return err('الشركة غير متاحة', 404)
  }
  const { _id, ...rest } = company
  return json({ id: _id, ...rest })
}

// ---------- Update ----------
export async function handleCompanyUpdate(id, request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const company = await Company.findById(id)
  if (!company) return err('الشركة غير موجودة', 404)
  const isOwner = company.userId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOwner && !isAdmin) return err('غير مصرح', 403)

  const body = await request.json().catch(() => ({}))
  const allowed = [
    'nameAr', 'nameEn', 'sector', 'governorate', 'description',
    'services', 'phone', 'email', 'website', 'location', 'logo',
  ]
  for (const k of allowed) {
    if (body[k] !== undefined) company[k] = body[k]
  }
  if (body.social !== undefined) company.social = sanitizeSocial(body.social)
  if (body.sector && !SECTOR_KEYS.includes(body.sector)) return err('القطاع غير صحيح', 400)
  if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
    return err('المحافظة غير صحيحة', 400)
  }

  if (body.lat !== undefined) {
    if (body.lat === null || body.lat === '') {
      company.lat = null
      company.lng = null
    } else {
      const latVal = Number(body.lat)
      const lngVal = Number(body.lng)
      if (
        !Number.isFinite(latVal) ||
        !Number.isFinite(lngVal) ||
        latVal < 16.6 || latVal > 27.0 ||
        lngVal < 51.5 || lngVal > 60.0
      ) {
        return err('الإحداثيات غير صحيحة (يجب أن تكون ضمن حدود سلطنة عُمان)', 400)
      }
      company.lat = latVal
      company.lng = lngVal
    }
  }

  if (!isAdmin) {
    company.status = 'PENDING'
    company.isApproved = false
    company.rejectionReason = null
  }
  company.updatedAt = new Date()
  await company.save()
  if (!isAdmin) {
    await Company.findByIdAndUpdate(company._id, {
      status: 'PENDING',
      isApproved: false,
      rejectionReason: null,
    })
  }

  const obj = company.toObject()
  const { _id, ...rest } = obj
  return json({
    success: true,
    company: {
      id: _id,
      ...rest,
      status: isAdmin ? (rest.status || 'APPROVED') : 'PENDING',
    },
  })
}

// ---------- Delete ----------
export async function handleCompanyDelete(id) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const company = await Company.findById(id)
  if (!company) return err('الشركة غير موجودة', 404)
  if (company.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return err('غير مصرح', 403)
  }
  await Company.deleteOne({ _id: id })
  return json({ success: true })
}

// ---------- My companies ----------
export async function handleMyCompanies() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const list = await Company.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()
  return json({
    companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
  })
}

// ---------- Admin list ----------
export async function handleAdminCompaniesList(request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
  await connectDB()
  const query = status === 'ALL' ? {} : { status }
  const list = await Company.find(query)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()
  return json({
    companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
  })
}

// ---------- Admin approve ----------
export async function handleAdminCompanyApprove(id) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const company = await Company.findByIdAndUpdate(
    id,
    {
      status: 'APPROVED',
      isApproved: true,
      rejectionReason: null,
      updatedAt: new Date(),
    },
    { new: true }
  ).lean()
  if (!company) return err('الشركة غير موجودة', 404)
  return json({ success: true, status: 'APPROVED' })
}

// ---------- Admin reject ----------
export async function handleAdminCompanyReject(id, request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  const body = await request.json().catch(() => ({}))
  const reason = (body?.reason || '').trim()
  if (!reason) return err('سبب الرفض مطلوب', 400)
  await connectDB()
  const company = await Company.findByIdAndUpdate(
    id,
    {
      status: 'REJECTED',
      isApproved: false,
      rejectionReason: reason,
      updatedAt: new Date(),
    },
    { new: true }
  ).lean()
  if (!company) return err('الشركة غير موجودة', 404)
  return json({ success: true, status: 'REJECTED' })
}
