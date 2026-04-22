import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Membership, PasswordResetToken, Company } from '@/lib/models'
import {
  TIER_META,
  TIERS,
  oneYearFromNow,
  applyDiscount,
  formatArabicDate,
  canListCompany,
} from '@/lib/membership'
import { SECTOR_KEYS, GOVERNORATE_KEYS } from '@/lib/directory'
import {
  sendWelcomeEmail,
  sendSubscriptionEmail,
  sendPasswordResetEmail,
} from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

function handleCORS(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.CORS_ORIGINS || '*'
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Health
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(
        NextResponse.json({ message: 'Majles API is running' })
      )
    }

    // -------- SIGNUP --------
    if (route === '/signup' && method === 'POST') {
      const body = await request.json()
      const { name, email, password } = body || {}

      if (!name || !email || !password) {
        return handleCORS(
          NextResponse.json(
            { error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' },
            { status: 400 }
          )
        )
      }

      if (password.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await User.findOne({ email: normalizedEmail }).lean()
      if (existing) {
        return handleCORS(
          NextResponse.json(
            { error: 'البريد الإلكتروني مسجل مسبقاً' },
            { status: 409 }
          )
        )
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: 'MEMBER',
        membershipTier: 'FREE',
      })

      // Fire-and-forget welcome email (must not break signup flow)
      sendWelcomeEmail({ to: user.email, name: user.name }).catch((e) =>
        console.error('welcome email failed:', e)
      )

      return handleCORS(
        NextResponse.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            membershipTier: user.membershipTier,
          },
        })
      )
    }

    // -------- ME --------
    if (route === '/me' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          membershipTier: user.membershipTier,
          membershipExpiry: user.membershipExpiry,
          createdAt: user.createdAt,
        })
      )
    }

    // -------- MEMBERSHIP: SUBSCRIBE (MOCK PAYMENT) --------
    if (route === '/membership/subscribe' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const { tier } = body || {}

      if (!tier || !TIERS.includes(tier)) {
        return handleCORS(
          NextResponse.json({ error: 'باقة غير صحيحة' }, { status: 400 })
        )
      }

      if (tier === 'FREE') {
        return handleCORS(
          NextResponse.json(
            { error: 'الباقة المجانية مفعلة تلقائياً' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const meta = TIER_META[tier]
      const now = new Date()
      const endDate = oneYearFromNow(now)

      // Update user tier & expiry
      const user = await User.findByIdAndUpdate(
        session.user.id,
        {
          membershipTier: tier,
          membershipExpiry: endDate,
        },
        { new: true }
      ).lean()

      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }

      // Record membership history (mocked payment = PAID)
      const membership = await Membership.create({
        userId: user._id,
        tier,
        startDate: now,
        endDate,
        amountPaid: meta.price,
        paymentStatus: 'PAID',
      })

      // Fire-and-forget subscription email
      sendSubscriptionEmail({
        to: user.email,
        name: user.name,
        tierAr: meta.nameAr,
        amount: meta.price,
        expiryFormatted: formatArabicDate(endDate),
      }).catch((e) => console.error('subscription email failed:', e))

      return handleCORS(
        NextResponse.json({
          success: true,
          membership: {
            id: membership._id,
            tier: membership.tier,
            startDate: membership.startDate,
            endDate: membership.endDate,
            amountPaid: membership.amountPaid,
            paymentStatus: membership.paymentStatus,
          },
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            membershipTier: user.membershipTier,
            membershipExpiry: user.membershipExpiry,
          },
        })
      )
    }

    // -------- MEMBERSHIP HISTORY --------
    if (route === '/membership/history' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const list = await Membership.find({ userId: session.user.id })
        .sort({ startDate: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          history: list.map((m) => ({
            id: m._id,
            tier: m.tier,
            startDate: m.startDate,
            endDate: m.endDate,
            amountPaid: m.amountPaid,
            paymentStatus: m.paymentStatus,
          })),
        })
      )
    }

    // -------- DISCOUNT CALCULATOR (for cart preview / demos) --------
    if (route === '/membership/discount' && method === 'POST') {
      const session = await getServerSession(authOptions)
      const body = await request.json().catch(() => ({}))
      const { price } = body || {}
      if (typeof price !== 'number' || price < 0) {
        return handleCORS(
          NextResponse.json({ error: 'السعر غير صحيح' }, { status: 400 })
        )
      }
      
      // Fetch fresh user data from database to get current tier
      let tier = 'FREE'
      if (session?.user?.id) {
        await connectDB()
        const user = await User.findById(session.user.id).lean()
        tier = user?.membershipTier || 'FREE'
      }
      
      const result = applyDiscount(price, tier)
      return handleCORS(NextResponse.json({ tier, ...result }))
    }

    /* ============================================================
       COMPANIES
       ============================================================ */

    // Helpers
    const companyDetailMatch = route.match(/^\/companies\/([A-Za-z0-9-]+)$/)
    const adminApproveMatch = route.match(
      /^\/admin\/companies\/([A-Za-z0-9-]+)\/approve$/
    )
    const adminRejectMatch = route.match(
      /^\/admin\/companies\/([A-Za-z0-9-]+)\/reject$/
    )

    // ---- GET /companies  (public list of APPROVED) ----
    if (route === '/companies' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('search') || '').trim()
      const sector = url.searchParams.get('sector') || ''
      const gov = url.searchParams.get('governorate') || ''

      await connectDB()
      const query = { status: 'APPROVED' }
      if (sector) query.sector = sector
      if (gov) query.governorate = gov
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }]
      }
      const list = await Company.find(query)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /companies  (auth + BASIC+) ----
    if (route === '/companies' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      const userTier = dbUser?.membershipTier || 'FREE'
      if (!canListCompany(userTier)) {
        return handleCORS(
          NextResponse.json(
            { error: 'تحتاج إلى باقة أساسية أو أعلى لإضافة شركة' },
            { status: 403 }
          )
        )
      }

      const body = await request.json().catch(() => ({}))
      const { nameAr, sector } = body || {}
      if (!nameAr || !sector) {
        return handleCORS(
          NextResponse.json(
            { error: 'اسم الشركة (عربي) والقطاع مطلوبان' },
            { status: 400 }
          )
        )
      }
      if (!SECTOR_KEYS.includes(sector)) {
        return handleCORS(
          NextResponse.json({ error: 'القطاع غير صحيح' }, { status: 400 })
        )
      }
      if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
        return handleCORS(
          NextResponse.json({ error: 'المحافظة غير صحيحة' }, { status: 400 })
        )
      }

      const company = await Company.create({
        userId: session.user.id,
        nameAr: String(nameAr).trim(),
        nameEn: body.nameEn ? String(body.nameEn).trim() : undefined,
        sector,
        governorate: body.governorate || undefined,
        description: body.description || '',
        services: Array.isArray(body.services)
          ? body.services.slice(0, 30)
          : [],
        phone: body.phone || '',
        email: body.email || '',
        website: body.website || '',
        location: body.location || '',
        logo: body.logo || '',
        status: 'PENDING',
        isApproved: false,
      })

      // Ensure status is set using update operation (workaround for schema issue)
      await Company.findByIdAndUpdate(company._id, { 
        status: 'PENDING', 
        isApproved: false 
      })

      const companyObj = company.toObject()
      return handleCORS(
        NextResponse.json({
          success: true,
          company: { 
            id: company._id, 
            ...companyObj, 
            _id: undefined,
            status: companyObj.status || 'PENDING',
            isApproved: companyObj.isApproved || false
          },
        })
      )
    }

    // ---- GET /companies/:id ----
    if (companyDetailMatch && method === 'GET') {
      const id = companyDetailMatch[1]
      await connectDB()
      const company = await Company.findById(id).lean()
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      // Non-approved only visible to owner or admin
      if (company.status !== 'APPROVED') {
        const session = await getServerSession(authOptions)
        const isOwner = session?.user?.id === company.userId
        const isAdmin = session?.user?.role === 'ADMIN'
        if (!isOwner && !isAdmin) {
          return handleCORS(
            NextResponse.json({ error: 'الشركة غير متاحة' }, { status: 404 })
          )
        }
      }
      const { _id, ...rest } = company
      return handleCORS(NextResponse.json({ id: _id, ...rest }))
    }

    // ---- PUT /companies/:id  (owner updates; resets to PENDING) ----
    if (companyDetailMatch && method === 'PUT') {
      const id = companyDetailMatch[1]
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const company = await Company.findById(id)
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      const isOwner = company.userId === session.user.id
      const isAdmin = session.user.role === 'ADMIN'
      if (!isOwner && !isAdmin) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
        )
      }

      const body = await request.json().catch(() => ({}))
      const allowed = [
        'nameAr',
        'nameEn',
        'sector',
        'governorate',
        'description',
        'services',
        'phone',
        'email',
        'website',
        'location',
        'logo',
      ]
      for (const k of allowed) {
        if (body[k] !== undefined) company[k] = body[k]
      }
      if (body.sector && !SECTOR_KEYS.includes(body.sector)) {
        return handleCORS(
          NextResponse.json({ error: 'القطاع غير صحيح' }, { status: 400 })
        )
      }
      if (body.governorate && !GOVERNORATE_KEYS.includes(body.governorate)) {
        return handleCORS(
          NextResponse.json({ error: 'المحافظة غير صحيحة' }, { status: 400 })
        )
      }

      // Any user edit resets approval (admin edits keep current status)
      if (!isAdmin) {
        company.status = 'PENDING'
        company.isApproved = false
        company.rejectionReason = null
      }
      company.updatedAt = new Date()
      await company.save()

      // Ensure status is updated in DB (workaround for schema issue)
      if (!isAdmin) {
        await Company.findByIdAndUpdate(company._id, { 
          status: 'PENDING', 
          isApproved: false,
          rejectionReason: null
        })
      }

      const obj = company.toObject()
      const { _id, ...rest } = obj
      return handleCORS(
        NextResponse.json({ 
          success: true, 
          company: { 
            id: _id, 
            ...rest,
            status: isAdmin ? (rest.status || 'APPROVED') : 'PENDING'
          } 
        })
      )
    }

    // ---- DELETE /companies/:id  (owner or admin) ----
    if (companyDetailMatch && method === 'DELETE') {
      const id = companyDetailMatch[1]
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const company = await Company.findById(id)
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      if (
        company.userId !== session.user.id &&
        session.user.role !== 'ADMIN'
      ) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
        )
      }
      await Company.deleteOne({ _id: id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // ---- GET /my-companies ----
    if (route === '/my-companies' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const list = await Company.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    /* ============================================================
       ADMIN
       ============================================================ */
    // ---- GET /admin/companies?status=PENDING ----
    if (route === '/admin/companies' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      if (session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const url = new URL(request.url)
      const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
      await connectDB()
      const query = status === 'ALL' ? {} : { status }
      const list = await Company.find(query)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
      return handleCORS(
        NextResponse.json({
          companies: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /admin/companies/:id/approve ----
    if (adminApproveMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminApproveMatch[1]
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
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: 'APPROVED' })
      )
    }

    // ---- POST /admin/companies/:id/reject ----
    if (adminRejectMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminRejectMatch[1]
      const body = await request.json().catch(() => ({}))
      const reason = (body?.reason || '').trim()
      if (!reason) {
        return handleCORS(
          NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
        )
      }
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
      if (!company) {
        return handleCORS(
          NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: 'REJECTED' })
      )
    }

    // -------- FORGOT PASSWORD --------
    if (route === '/forgot-password' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { email } = body || {}
      if (!email || typeof email !== 'string') {
        return handleCORS(
          NextResponse.json(
            { error: 'البريد الإلكتروني مطلوب' },
            { status: 400 }
          )
        )
      }
      const normalizedEmail = email.toLowerCase().trim()

      await connectDB()
      const user = await User.findOne({ email: normalizedEmail }).lean()

      // Always respond success to avoid email enumeration
      if (user) {
        // Invalidate any previous active tokens
        await PasswordResetToken.updateMany(
          { userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } },
          { $set: { usedAt: new Date() } }
        )

        const rawToken = crypto.randomBytes(32).toString('hex')
        const tokenHash = sha256(rawToken)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        await PasswordResetToken.create({
          userId: user._id,
          tokenHash,
          expiresAt,
        })

        const resetUrl = `${BASE_URL}/reset-password?token=${rawToken}`
        sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        }).catch((e) => console.error('reset email failed:', e))
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          message:
            'إذا كان البريد مسجلاً لدينا، فسيصلك رابط إعادة تعيين كلمة المرور',
        })
      )
    }

    // -------- RESET PASSWORD --------
    if (route === '/reset-password' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { token, password } = body || {}

      if (!token || !password) {
        return handleCORS(
          NextResponse.json(
            { error: 'الرابط وكلمة المرور مطلوبة' },
            { status: 400 }
          )
        )
      }
      if (password.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const tokenHash = sha256(token)
      const resetDoc = await PasswordResetToken.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })

      if (!resetDoc) {
        return handleCORS(
          NextResponse.json(
            {
              error:
                'الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد',
            },
            { status: 400 }
          )
        )
      }

      const hashed = await bcrypt.hash(password, 10)
      await User.findByIdAndUpdate(resetDoc.userId, { password: hashed })

      // Mark token used
      resetDoc.usedAt = new Date()
      await resetDoc.save()

      return handleCORS(
        NextResponse.json({
          success: true,
          message: 'تم تحديث كلمة المرور بنجاح',
        })
      )
    }

    return handleCORS(
      NextResponse.json({ error: `Route ${route} not found` }, { status: 404 })
    )
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(
      NextResponse.json(
        { error: 'خطأ داخلي في الخادم' },
        { status: 500 }
      )
    )
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
