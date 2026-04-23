import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Membership, PasswordResetToken, Company, Expert, Availability, Appointment } from '@/lib/models'
import {
  TIER_META,
  TIERS,
  oneYearFromNow,
  applyDiscount,
  formatArabicDate,
  canListCompany,
  tierAtLeast,
  TIER_DISCOUNT,
} from '@/lib/membership'
import { SECTOR_KEYS, GOVERNORATE_KEYS } from '@/lib/directory'
import {
  SPECIALTY_KEYS,
  specialtyLabel,
  generateHourlySlots,
  computeSessionPrice,
} from '@/lib/experts'
import {
  sendWelcomeEmail,
  sendSubscriptionEmail,
  sendPasswordResetEmail,
  sendAppointmentConfirmationEmail,
  sendNewBookingNotifyExpert,
  sendAppointmentCancellationEmail,
  sendAppointmentReminderEmail,
} from '@/lib/email'
import { getPaymentProvider, isRealPayment } from '@/lib/payments'

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
          phone: user.phone || '',
          photo: user.photo || '',
          role: user.role,
          membershipTier: user.membershipTier,
          membershipExpiry: user.membershipExpiry,
          createdAt: user.createdAt,
        })
      )
    }

    // -------- PUT /me (update profile: name, phone, photo) --------
    if (route === '/me' && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const updates = {}

      if (typeof body.name === 'string') {
        const name = body.name.trim()
        if (name.length < 2 || name.length > 80) {
          return handleCORS(
            NextResponse.json(
              { error: 'الاسم يجب أن يكون بين 2 و 80 حرفاً' },
              { status: 400 }
            )
          )
        }
        updates.name = name
      }

      if (typeof body.phone === 'string') {
        const phone = body.phone.trim()
        if (phone && !/^[+\d\s-]{6,25}$/.test(phone)) {
          return handleCORS(
            NextResponse.json(
              { error: 'رقم الهاتف غير صحيح' },
              { status: 400 }
            )
          )
        }
        updates.phone = phone
      }

      if (typeof body.photo === 'string') {
        const photo = body.photo
        if (photo === '') {
          updates.photo = ''
        } else {
          // Must be a data URL image, size <= ~1.5MB base64
          if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(photo)) {
            return handleCORS(
              NextResponse.json(
                { error: 'صيغة الصورة غير مدعومة' },
                { status: 400 }
              )
            )
          }
          if (photo.length > 2_000_000) {
            return handleCORS(
              NextResponse.json(
                { error: 'حجم الصورة كبير جداً (الحد الأقصى 1.5MB)' },
                { status: 400 }
              )
            )
          }
          updates.photo = photo
        }
      }

      if (Object.keys(updates).length === 0) {
        return handleCORS(
          NextResponse.json({ error: 'لا توجد تغييرات' }, { status: 400 })
        )
      }

      await connectDB()
      const user = await User.findByIdAndUpdate(
        session.user.id,
        { $set: updates },
        { new: true }
      ).lean()
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            photo: user.photo || '',
            role: user.role,
            membershipTier: user.membershipTier,
          },
        })
      )
    }

    // -------- POST /me/change-password --------
    if (route === '/me/change-password' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const currentPassword = (body?.currentPassword || '').toString()
      const newPassword = (body?.newPassword || '').toString()

      if (!currentPassword || !newPassword) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الحالية والجديدة مطلوبتان' },
            { status: 400 }
          )
        )
      }
      if (newPassword.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }
      if (currentPassword === newPassword) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const user = await User.findById(session.user.id)
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور الحالية غير صحيحة' },
            { status: 400 }
          )
        )
      }
      user.password = await bcrypt.hash(newPassword, 10)
      await user.save()
      // Invalidate any outstanding reset tokens for safety
      await PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null },
        { $set: { usedAt: new Date() } }
      )
      return handleCORS(
        NextResponse.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' })
      )
    }

    // -------- DELETE /me (delete account with password confirmation) --------
    if (route === '/me' && method === 'DELETE') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const password = (body?.password || '').toString()
      const confirm = (body?.confirm || '').toString()

      if (!password) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور مطلوبة لتأكيد الحذف' },
            { status: 400 }
          )
        )
      }
      if (confirm !== 'DELETE' && confirm !== 'حذف') {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب كتابة كلمة "حذف" لتأكيد العملية' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const user = await User.findById(session.user.id)
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      if (user.role === 'ADMIN') {
        return handleCORS(
          NextResponse.json(
            { error: 'لا يمكن حذف حساب المسؤول من هذه الصفحة' },
            { status: 403 }
          )
        )
      }
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        return handleCORS(
          NextResponse.json(
            { error: 'كلمة المرور غير صحيحة' },
            { status: 400 }
          )
        )
      }

      const uid = user._id

      // Cancel user's future CONFIRMED appointments as client
      await Appointment.updateMany(
        { clientId: uid, status: 'CONFIRMED', date: { $gte: new Date() } },
        { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'client' } }
      )

      // If user is an expert, cancel their future appointments and remove their expert record + availability
      const expert = await Expert.findOne({ userId: uid })
      if (expert) {
        await Appointment.updateMany(
          { expertId: expert._id, status: 'CONFIRMED', date: { $gte: new Date() } },
          { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'expert' } }
        )
        await Availability.deleteMany({ expertId: expert._id })
        await Expert.deleteOne({ _id: expert._id })
      }

      // Delete user's companies
      await Company.deleteMany({ userId: uid })

      // Delete memberships & password reset tokens
      await Membership.deleteMany({ userId: uid })
      await PasswordResetToken.deleteMany({ userId: uid })

      // Finally delete user
      await User.deleteOne({ _id: uid })

      return handleCORS(
        NextResponse.json({ success: true, message: 'تم حذف الحساب' })
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

    /* ============================================================
       EXPERTS & APPOINTMENTS
       ============================================================ */

    const expertDetailMatch = route.match(/^\/experts\/([A-Za-z0-9-]+)$/)
    const expertAvailMatch = route.match(
      /^\/experts\/([A-Za-z0-9-]+)\/availability$/
    )
    const expertSlotsMatch = route.match(
      /^\/experts\/([A-Za-z0-9-]+)\/slots$/
    )
    const apptCancelMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/cancel$/
    )
    const apptReviewMatch = route.match(
      /^\/appointments\/([A-Za-z0-9-]+)\/review$/
    )
    const adminExpApproveMatch = route.match(
      /^\/admin\/experts\/([A-Za-z0-9-]+)\/approve$/
    )
    const adminExpRejectMatch = route.match(
      /^\/admin\/experts\/([A-Za-z0-9-]+)\/reject$/
    )

    // ---- GET /experts (public, APPROVED only) ----
    if (route === '/experts' && method === 'GET') {
      const url = new URL(request.url)
      const specialty = url.searchParams.get('specialty') || ''
      await connectDB()
      const q = { status: 'APPROVED' }
      if (specialty) q.specialty = specialty
      const list = await Expert.find(q)
        .sort({ rating: -1, createdAt: -1 })
        .lean()
      const users = await User.find({ _id: { $in: list.map((e) => e.userId) } })
        .select({ _id: 1, name: 1 })
        .lean()
      const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
      return handleCORS(
        NextResponse.json({
          experts: list.map((e) => ({
            id: e._id,
            userId: e.userId,
            name: userMap[e.userId]?.name,
            specialty: e.specialty,
            specialtyAr: e.specialtyAr,
            bio: e.bio,
            photo: e.photo,
            hourlyRate: e.hourlyRate,
            experienceYears: e.experienceYears,
            rating: e.rating,
            totalSessions: e.totalSessions,
          })),
        })
      )
    }

    // ---- POST /experts/apply ----
    if (route === '/experts/apply' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      await connectDB()
      const dbUser = await User.findById(session.user.id).lean()
      if (!tierAtLeast(dbUser?.membershipTier || 'FREE', 'GOLD')) {
        return handleCORS(
          NextResponse.json(
            { error: 'الباقة الذهبية أو البلاتينية مطلوبة لتسجيل الخبير' },
            { status: 403 }
          )
        )
      }
      const existing = await Expert.findOne({ userId: session.user.id }).lean()
      if (existing) {
        return handleCORS(
          NextResponse.json(
            { error: 'لديك طلب تسجيل خبير مسبقاً', status: existing.status },
            { status: 409 }
          )
        )
      }
      const body = await request.json().catch(() => ({}))
      const { specialty, specialtyAr, bio, experienceYears, hourlyRate, photo, cv } = body || {}
      if (!specialty || !SPECIALTY_KEYS.includes(specialty)) {
        return handleCORS(
          NextResponse.json({ error: 'التخصص غير صحيح' }, { status: 400 })
        )
      }
      if (!hourlyRate || Number(hourlyRate) <= 0) {
        return handleCORS(
          NextResponse.json({ error: 'سعر الساعة مطلوب' }, { status: 400 })
        )
      }
      const expert = await Expert.create({
        userId: session.user.id,
        specialty,
        specialtyAr: specialtyAr || specialtyLabel(specialty),
        bio: bio || '',
        experienceYears: Number(experienceYears) || 0,
        hourlyRate: Number(hourlyRate),
        photo: photo || '',
        cv: cv || '',
        status: 'PENDING',
        isApproved: false,
      })
      return handleCORS(
        NextResponse.json({
          success: true,
          expert: { id: expert._id, status: expert.status },
        })
      )
    }

    // ---- GET /experts/me ----
    if (route === '/experts/me' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const expert = await Expert.findOne({ userId: session.user.id }).lean()
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'لست خبيراً' }, { status: 404 })
        )
      }
      const { _id, ...rest } = expert
      return handleCORS(NextResponse.json({ id: _id, ...rest }))
    }

    // ---- PUT /experts/me/availability ----
    if (route === '/experts/me/availability' && method === 'PUT') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const expert = await Expert.findOne({ userId: session.user.id })
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'لست خبيراً' }, { status: 404 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const items = Array.isArray(body?.availability) ? body.availability : []
      // Validate items
      for (const it of items) {
        if (
          typeof it.dayOfWeek !== 'number' ||
          it.dayOfWeek < 0 ||
          it.dayOfWeek > 6
        ) {
          return handleCORS(
            NextResponse.json({ error: 'يوم غير صحيح' }, { status: 400 })
          )
        }
        if (!/^\d{2}:\d{2}$/.test(it.startTime) || !/^\d{2}:\d{2}$/.test(it.endTime)) {
          return handleCORS(
            NextResponse.json({ error: 'صيغة الوقت غير صحيحة' }, { status: 400 })
          )
        }
      }
      // Replace all existing
      await Availability.deleteMany({ expertId: expert._id })
      if (items.length > 0) {
        await Availability.insertMany(
          items.map((it) => ({
            expertId: expert._id,
            dayOfWeek: it.dayOfWeek,
            startTime: it.startTime,
            endTime: it.endTime,
          }))
        )
      }
      return handleCORS(NextResponse.json({ success: true, count: items.length }))
    }

    // ---- GET /experts/:id/reviews (public reviews for an expert) ----
    if (
      /^\/experts\/([A-Za-z0-9-]+)\/reviews$/.test(route) &&
      method === 'GET'
    ) {
      const id = route.match(/^\/experts\/([A-Za-z0-9-]+)\/reviews$/)[1]
      await connectDB()
      const list = await Appointment.find({
        expertId: id,
        rating: { $gte: 1 },
      })
        .sort({ reviewedAt: -1 })
        .limit(50)
        .lean()
      const clientIds = Array.from(new Set(list.map((a) => a.clientId)))
      const clients = await User.find({ _id: { $in: clientIds } })
        .select({ _id: 1, name: 1 })
        .lean()
      const clientMap = Object.fromEntries(clients.map((c) => [c._id, c]))
      return handleCORS(
        NextResponse.json({
          reviews: list.map((a) => ({
            id: a._id,
            rating: a.rating,
            comment: a.reviewComment,
            reviewedAt: a.reviewedAt,
            clientName: clientMap[a.clientId]?.name || 'عميل',
          })),
        })
      )
    }

    // ---- GET /experts/:id/availability ----
    if (expertAvailMatch && method === 'GET') {
      const id = expertAvailMatch[1]
      await connectDB()
      const list = await Availability.find({ expertId: id })
        .sort({ dayOfWeek: 1, startTime: 1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          availability: list.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        })
      )
    }

    // ---- GET /experts/:id/slots?date=YYYY-MM-DD ----
    if (expertSlotsMatch && method === 'GET') {
      const id = expertSlotsMatch[1]
      const url = new URL(request.url)
      const dateStr = url.searchParams.get('date')
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      const d = new Date(dateStr + 'T00:00:00.000Z')
      if (isNaN(d.getTime())) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      const dayOfWeek = d.getUTCDay()
      await connectDB()
      const avail = await Availability.find({
        expertId: id,
        dayOfWeek,
      }).lean()
      const slots = generateHourlySlots(avail)
      // subtract already-booked (CONFIRMED or PENDING) on same date
      const dayStart = new Date(d)
      const dayEnd = new Date(d)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      const taken = await Appointment.find({
        expertId: id,
        status: { $in: ['CONFIRMED', 'PENDING'] },
        date: { $gte: dayStart, $lt: dayEnd },
      })
        .select({ startTime: 1 })
        .lean()
      const takenSet = new Set(taken.map((a) => a.startTime))
      const available = slots.filter((s) => !takenSet.has(s.startTime))
      return handleCORS(NextResponse.json({ slots: available }))
    }

    // ---- GET /experts/:id (public) ----
    if (expertDetailMatch && method === 'GET') {
      const id = expertDetailMatch[1]
      await connectDB()
      const expert = await Expert.findById(id).lean()
      if (!expert) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      if (expert.status !== 'APPROVED') {
        const session = await getServerSession(authOptions)
        if (
          session?.user?.id !== expert.userId &&
          session?.user?.role !== 'ADMIN'
        ) {
          return handleCORS(
            NextResponse.json({ error: 'الخبير غير متاح' }, { status: 404 })
          )
        }
      }
      const owner = await User.findById(expert.userId).select({ name: 1 }).lean()
      const { _id, ...rest } = expert
      return handleCORS(
        NextResponse.json({ id: _id, ...rest, name: owner?.name })
      )
    }

    // ---- POST /appointments (book) ----
    if (route === '/appointments' && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
        )
      }
      const body = await request.json().catch(() => ({}))
      const { expertId, date, startTime, endTime } = body || {}
      if (!expertId || !date || !startTime || !endTime) {
        return handleCORS(
          NextResponse.json({ error: 'بيانات الحجز ناقصة' }, { status: 400 })
        )
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return handleCORS(
          NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
        )
      }
      await connectDB()
      const expert = await Expert.findById(expertId).lean()
      if (!expert || expert.status !== 'APPROVED') {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير متاح' }, { status: 404 })
        )
      }
      if (expert.userId === session.user.id) {
        return handleCORS(
          NextResponse.json(
            { error: 'لا يمكنك حجز جلسة مع نفسك' },
            { status: 400 }
          )
        )
      }
      // validate slot is in availability and not already taken
      const day = new Date(date + 'T00:00:00.000Z')
      const dayOfWeek = day.getUTCDay()
      const availOk = await Availability.findOne({
        expertId,
        dayOfWeek,
        startTime: { $lte: startTime },
        endTime: { $gte: endTime },
      }).lean()
      if (!availOk) {
        return handleCORS(
          NextResponse.json({ error: 'الوقت غير ضمن أوقات المتاحة' }, { status: 400 })
        )
      }
      const dayEnd = new Date(day)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      const conflict = await Appointment.findOne({
        expertId,
        status: { $in: ['CONFIRMED', 'PENDING'] },
        date: { $gte: day, $lt: dayEnd },
        startTime,
      }).lean()
      if (conflict) {
        return handleCORS(
          NextResponse.json({ error: 'هذا الموعد محجوز بالفعل' }, { status: 409 })
        )
      }
      // pricing
      const client = await User.findById(session.user.id).lean()
      const clientTier = client?.membershipTier || 'FREE'
      const price = computeSessionPrice(
        expert.hourlyRate,
        TIER_DISCOUNT[clientTier] || 0
      )
      const appt = await Appointment.create({
        clientId: session.user.id,
        expertId,
        date: day,
        startTime,
        endTime,
        status: 'CONFIRMED',
        totalPaid: price.finalPrice,
        originalPrice: price.originalPrice,
        discountPercent: price.discountPercent,
      })

      // Fire-and-forget: emails to client + expert
      try {
        const expertUser = await User.findById(expert.userId)
          .select({ email: 1, name: 1 })
          .lean()
        const dateFmt = formatArabicDate(day)
        sendAppointmentConfirmationEmail({
          to: client.email,
          name: client.name,
          expertName: expertUser?.name || 'الخبير',
          dateFormatted: dateFmt,
          startTime,
          endTime,
          amount: price.finalPrice,
        }).catch((e) => console.error('[appt] client email failed:', e))
        if (expertUser?.email) {
          sendNewBookingNotifyExpert({
            to: expertUser.email,
            expertName: expertUser.name,
            clientName: client.name,
            dateFormatted: dateFmt,
            startTime,
            endTime,
            amount: price.finalPrice,
          }).catch((e) => console.error('[appt] expert email failed:', e))
        }
      } catch (emailErr) {
        console.error('[appt] email lookup failed:', emailErr)
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          appointment: {
            id: appt._id,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
            totalPaid: appt.totalPaid,
            status: appt.status,
          },
        })
      )
    }

    // ---- GET /appointments (mine as client or expert) ----
    if (route === '/appointments' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const url = new URL(request.url)
      const as = url.searchParams.get('as') || 'client' // 'client' | 'expert'
      const q = {}
      if (as === 'expert') {
        const expert = await Expert.findOne({ userId: session.user.id }).lean()
        if (!expert) {
          return handleCORS(NextResponse.json({ appointments: [] }))
        }
        q.expertId = expert._id
      } else {
        q.clientId = session.user.id
      }
      const appts = await Appointment.find(q)
        .sort({ date: -1, startTime: -1 })
        .lean()
      return handleCORS(
        NextResponse.json({
          appointments: appts.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    // ---- POST /appointments/:id/cancel ----
    if (apptCancelMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const id = apptCancelMatch[1]
      await connectDB()
      const appt = await Appointment.findById(id)
      if (!appt) {
        return handleCORS(
          NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
        )
      }
      // Must be client, expert owner, or admin
      let isExpert = false
      if (appt.clientId !== session.user.id) {
        const expert = await Expert.findById(appt.expertId).lean()
        if (expert?.userId === session.user.id) isExpert = true
        else if (session.user.role !== 'ADMIN') {
          return handleCORS(
            NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
          )
        }
      }
      if (appt.status === 'CANCELLED') {
        return handleCORS(
          NextResponse.json({ error: 'الحجز ملغي مسبقاً' }, { status: 400 })
        )
      }
      // 24h rule for clients (admin/expert bypass)
      if (!isExpert && session.user.role !== 'ADMIN') {
        const d = new Date(appt.date)
        const [h, m] = appt.startTime.split(':').map(Number)
        d.setUTCHours(h, m, 0, 0)
        const hoursUntil = (d.getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntil < 24) {
          return handleCORS(
            NextResponse.json(
              { error: 'لا يمكن الإلغاء قبل الجلسة بأقل من 24 ساعة' },
              { status: 400 }
            )
          )
        }
      }
      appt.status = 'CANCELLED'
      appt.cancelledAt = new Date()
      appt.cancelledBy = isExpert
        ? 'expert'
        : session.user.role === 'ADMIN'
        ? 'admin'
        : 'client'
      await appt.save()

      // Fire-and-forget cancellation email to client
      try {
        const client = await User.findById(appt.clientId)
          .select({ email: 1, name: 1 })
          .lean()
        const expert = await Expert.findById(appt.expertId).lean()
        const expertUser = expert
          ? await User.findById(expert.userId).select({ name: 1 }).lean()
          : null
        if (client?.email) {
          sendAppointmentCancellationEmail({
            to: client.email,
            name: client.name,
            expertName: expertUser?.name || 'الخبير',
            dateFormatted: formatArabicDate(appt.date),
            startTime: appt.startTime,
            cancelledBy: appt.cancelledBy,
          }).catch((e) => console.error('[cancel] email failed:', e))
        }
      } catch (e) {
        console.error('[cancel] email lookup failed:', e)
      }

      return handleCORS(NextResponse.json({ success: true }))
    }

    // ---- POST /appointments/:id/review (client rates expert after session) ----
    if (apptReviewMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      const id = apptReviewMatch[1]
      const body = await request.json().catch(() => ({}))
      const rating = Number(body?.rating)
      const comment = (body?.comment || '').toString().slice(0, 1000)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return handleCORS(
          NextResponse.json({ error: 'التقييم يجب أن يكون بين 1 و 5 نجوم' }, { status: 400 })
        )
      }

      await connectDB()
      const appt = await Appointment.findById(id)
      if (!appt) {
        return handleCORS(
          NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 })
        )
      }
      if (appt.clientId !== session.user.id) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكنك تقييم جلسة ليست لك' }, { status: 403 })
        )
      }
      // Must be a past appointment (end datetime passed)
      const apptEnd = new Date(appt.date)
      const [eh, em] = (appt.endTime || '00:00').split(':').map(Number)
      apptEnd.setUTCHours(eh, em, 0, 0)
      if (apptEnd > new Date()) {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكن التقييم قبل انتهاء الجلسة' }, { status: 400 })
        )
      }
      if (appt.status === 'CANCELLED') {
        return handleCORS(
          NextResponse.json({ error: 'لا يمكن تقييم جلسة ملغاة' }, { status: 400 })
        )
      }
      if (appt.reviewedAt) {
        return handleCORS(
          NextResponse.json({ error: 'لقد قمت بتقييم هذه الجلسة مسبقاً' }, { status: 409 })
        )
      }

      appt.rating = rating
      appt.reviewComment = comment
      appt.reviewedAt = new Date()
      if (appt.status === 'CONFIRMED') appt.status = 'COMPLETED'
      await appt.save()

      // Recompute expert aggregate rating & session count
      const agg = await Appointment.aggregate([
        {
          $match: {
            expertId: appt.expertId,
            rating: { $gte: 1 },
          },
        },
        {
          $group: {
            _id: '$expertId',
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      const row = agg[0]
      const completedCount = await Appointment.countDocuments({
        expertId: appt.expertId,
        status: 'COMPLETED',
      })
      await Expert.updateOne(
        { _id: appt.expertId },
        {
          $set: {
            rating: row ? Number(row.avg.toFixed(2)) : 0,
            totalSessions: completedCount,
          },
        }
      )

      return handleCORS(
        NextResponse.json({ success: true, appointment: { id: appt._id, rating, comment, status: appt.status } })
      )
    }
    if (route === '/admin/experts' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const url = new URL(request.url)
      const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
      await connectDB()
      const q = status === 'ALL' ? {} : { status }
      const list = await Expert.find(q).sort({ createdAt: -1 }).lean()
      return handleCORS(
        NextResponse.json({
          experts: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
        })
      )
    }

    if (adminExpApproveMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminExpApproveMatch[1]
      await connectDB()
      const updated = await Expert.findByIdAndUpdate(
        id,
        {
          status: 'APPROVED',
          isApproved: true,
          rejectionReason: null,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!updated) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      // promote user role to EXPERT
      await User.findByIdAndUpdate(updated.userId, { role: 'EXPERT' })
      return handleCORS(
        NextResponse.json({ success: true, status: updated.status })
      )
    }

    if (adminExpRejectMatch && method === 'POST') {
      const session = await getServerSession(authOptions)
      if (!session?.user || session.user.role !== 'ADMIN') {
        return handleCORS(
          NextResponse.json({ error: 'صلاحيات مسؤول مطلوبة' }, { status: 403 })
        )
      }
      const id = adminExpRejectMatch[1]
      const body = await request.json().catch(() => ({}))
      const reason = (body?.reason || '').trim()
      if (!reason) {
        return handleCORS(
          NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 })
        )
      }
      await connectDB()
      const updated = await Expert.findByIdAndUpdate(
        id,
        {
          status: 'REJECTED',
          isApproved: false,
          rejectionReason: reason,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean()
      if (!updated) {
        return handleCORS(
          NextResponse.json({ error: 'الخبير غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({ success: true, status: updated.status })
      )
    }



    // -------- CRON: send 24h reminders --------
    // Triggered by an external scheduler (cron-job.org, UptimeRobot, vercel cron, etc.)
    // hitting this URL every hour:
    //   POST {BASE_URL}/api/cron/send-reminders
    //   Header: Authorization: Bearer ${CRON_SECRET}
    if (route === '/cron/send-reminders' && method === 'POST') {
      const auth = request.headers.get('authorization') || ''
      const secret = process.env.CRON_SECRET
      if (!secret) {
        return handleCORS(
          NextResponse.json(
            { error: 'CRON_SECRET غير مضبوط في البيئة' },
            { status: 500 }
          )
        )
      }
      if (auth !== `Bearer ${secret}`) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }

      await connectDB()
      const now = new Date()
      // Window: appointments starting between now+23h and now+25h, not yet reminded, still CONFIRMED.
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)

      // Fetch all CONFIRMED that might be tomorrow and not reminded
      const dayStartCandidate = new Date(windowStart)
      dayStartCandidate.setUTCHours(0, 0, 0, 0)
      const dayEndCandidate = new Date(windowEnd)
      dayEndCandidate.setUTCHours(23, 59, 59, 999)

      const candidates = await Appointment.find({
        status: 'CONFIRMED',
        reminderSentAt: null,
        date: { $gte: dayStartCandidate, $lte: dayEndCandidate },
      }).lean()

      const toRemind = candidates.filter((a) => {
        const d = new Date(a.date)
        const [h, m] = (a.startTime || '00:00').split(':').map(Number)
        d.setUTCHours(h, m, 0, 0)
        return d >= windowStart && d <= windowEnd
      })

      let sent = 0
      let failed = 0
      for (const appt of toRemind) {
        try {
          const client = await User.findById(appt.clientId)
            .select({ email: 1, name: 1 })
            .lean()
          const expert = await Expert.findById(appt.expertId).lean()
          const expertUser = expert
            ? await User.findById(expert.userId).select({ name: 1 }).lean()
            : null
          if (client?.email) {
            await sendAppointmentReminderEmail({
              to: client.email,
              name: client.name,
              expertName: expertUser?.name || 'الخبير',
              dateFormatted: formatArabicDate(appt.date),
              startTime: appt.startTime,
              endTime: appt.endTime,
            })
          }
          await Appointment.updateOne(
            { _id: appt._id },
            { $set: { reminderSentAt: new Date() } }
          )
          sent += 1
        } catch (err) {
          console.error('[cron] reminder failed for', appt._id, err)
          failed += 1
        }
      }

      return handleCORS(
        NextResponse.json({
          success: true,
          considered: toRemind.length,
          sent,
          failed,
        })
      )
    }

    // -------- PAYMENT WEBHOOK (generic, routes to configured provider) --------
    if (route === '/payments/webhook' && method === 'POST') {
      try {
        const provider = getPaymentProvider()
        const event = await provider.parseWebhook(request)
        if (!event) {
          return handleCORS(
            NextResponse.json({ received: false }, { status: 400 })
          )
        }
        // At this layer we just acknowledge. Actual state mutation (mark
        // Membership/Appointment as PAID) should be wired based on metadata
        // when switching from 'mock' to a real gateway like Thawani.
        console.log('[payments] webhook', provider.name, event)
        return handleCORS(
          NextResponse.json({ received: true, sessionId: event.sessionId })
        )
      } catch (err) {
        console.error('[payments] webhook error:', err)
        return handleCORS(
          NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        )
      }
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
