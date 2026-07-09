/**
 * Experts, Availability, Appointments, and admin expert approvals.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Expert, Availability, Appointment } from '@/lib/models'
import { COMMISSION_PERCENT } from '@/lib/store'
import { tierAtLeast, TIER_DISCOUNT, EXPERT_MIN_TIER, formatArabicDate } from '@/lib/membership'
import { AGREEMENT_VERSION } from '@/lib/expert-agreement'
import {
  SPECIALTY_KEYS,
  specialtyLabel,
  generateHourlySlots,
  computeSessionPrice,
} from '@/lib/experts'
import { sanitizeSocial } from '@/lib/social'
import {
  sendAppointmentConfirmationEmail,
  sendNewBookingNotifyExpert,
  sendAppointmentCancellationEmail,
} from '@/lib/email'
import { json, err, requireAuth, requireRole } from './_helpers'

// ---------- Public list ----------
export async function handleExpertsList(request) {
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
  return json({
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
}

// ---------- Apply ----------
export async function handleExpertApply(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!tierAtLeast(dbUser?.membershipTier || 'FREE', EXPERT_MIN_TIER)) {
    return err('الباقة الذهبية أو البلاتينية مطلوبة لتسجيل الخبير', 403)
  }
  const existing = await Expert.findOne({ userId: session.user.id }).lean()
  if (existing) {
    return json(
      { error: 'لديك طلب تسجيل خبير مسبقاً', status: existing.status },
      { status: 409 }
    )
  }
  const body = await request.json().catch(() => ({}))
  const { specialty, specialtyAr, bio, experienceYears, hourlyRate, photo, cv } = body || {}
  if (!specialty || !SPECIALTY_KEYS.includes(specialty)) return err('التخصص غير صحيح', 400)
  if (!hourlyRate || Number(hourlyRate) <= 0) return err('سعر الساعة مطلوب', 400)

  // ---- Mandatory expert onboarding contract ----
  if (body.agreementAccepted !== true) {
    return err(
      'يجب الموافقة على عقد الخبير قبل التسجيل. الرجاء قراءة البنود والموافقة عليها.',
      400
    )
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    ''

  const expert = await Expert.create({
    userId: session.user.id,
    specialty,
    specialtyAr: specialtyAr || specialtyLabel(specialty),
    bio: bio || '',
    experienceYears: Number(experienceYears) || 0,
    hourlyRate: Number(hourlyRate),
    photo: photo || '',
    cv: cv || '',
    phone: body.phone || '',
    email: body.email || '',
    website: body.website || '',
    social: sanitizeSocial(body.social),
    status: 'PENDING',
    isApproved: false,
    agreementAccepted: true,
    agreementVersion: AGREEMENT_VERSION,
    agreementAcceptedAt: new Date(),
    agreementIp: ip,
  })
  return json({ success: true, expert: { id: expert._id, status: expert.status } })
}

// ---------- Me ----------
export async function handleExpertMe() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const expert = await Expert.findOne({ userId: session.user.id }).lean()
  if (!expert) return err('لست خبيراً', 404)
  const { _id, ...rest } = expert
  return json({ id: _id, ...rest })
}

export async function handleExpertMeUpdate(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const expert = await Expert.findOne({ userId: session.user.id })
  if (!expert) return err('لست خبيراً', 404)
  const body = await request.json().catch(() => ({}))
  const editable = [
    'bio', 'experienceYears', 'hourlyRate', 'photo', 'cv',
    'specialty', 'specialtyAr', 'phone', 'email', 'website',
  ]
  for (const k of editable) {
    if (body[k] !== undefined) {
      if (k === 'specialty' && !SPECIALTY_KEYS.includes(body[k])) continue
      if (k === 'experienceYears') expert[k] = Number(body[k]) || 0
      else if (k === 'hourlyRate') expert[k] = Number(body[k]) || expert[k]
      else expert[k] = body[k]
    }
  }
  if (body.social !== undefined) expert.social = sanitizeSocial(body.social)
  expert.updatedAt = new Date()
  await expert.save()
  const obj = expert.toObject()
  return json({ success: true, expert: { id: obj._id, ...obj, _id: undefined } })
}

// ---------- Availability (mine) ----------
export async function handleExpertAvailabilityUpdate(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const expert = await Expert.findOne({ userId: session.user.id })
  if (!expert) return err('لست خبيراً', 404)
  const body = await request.json().catch(() => ({}))
  const items = Array.isArray(body?.availability) ? body.availability : []
  for (const it of items) {
    if (typeof it.dayOfWeek !== 'number' || it.dayOfWeek < 0 || it.dayOfWeek > 6) {
      return err('يوم غير صحيح', 400)
    }
    if (!/^\d{2}:\d{2}$/.test(it.startTime) || !/^\d{2}:\d{2}$/.test(it.endTime)) {
      return err('صيغة الوقت غير صحيحة', 400)
    }
  }
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
  return json({ success: true, count: items.length })
}

// ---------- Public reviews / availability / slots / detail ----------
export async function handleExpertReviews(id) {
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
  return json({
    reviews: list.map((a) => ({
      id: a._id,
      rating: a.rating,
      comment: a.reviewComment,
      reviewedAt: a.reviewedAt,
      clientName: clientMap[a.clientId]?.name || 'عميل',
    })),
  })
}

export async function handleExpertAvailabilityGet(id) {
  await connectDB()
  const list = await Availability.find({ expertId: id })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()
  return json({
    availability: list.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
  })
}

export async function handleExpertSlots(id, request) {
  const url = new URL(request.url)
  const dateStr = url.searchParams.get('date')
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return err('تاريخ غير صحيح', 400)
  const d = new Date(dateStr + 'T00:00:00.000Z')
  if (isNaN(d.getTime())) return err('تاريخ غير صحيح', 400)
  const dayOfWeek = d.getUTCDay()
  await connectDB()
  const avail = await Availability.find({ expertId: id, dayOfWeek }).lean()
  const slots = generateHourlySlots(avail)
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
  return json({ slots: available })
}

export async function handleExpertDetail(id) {
  await connectDB()
  const expert = await Expert.findById(id).lean()
  if (!expert) return err('الخبير غير موجود', 404)
  if (expert.status !== 'APPROVED') {
    const session = await getServerSession(authOptions)
    if (session?.user?.id !== expert.userId && session?.user?.role !== 'ADMIN') {
      return err('الخبير غير متاح', 404)
    }
  }
  const owner = await User.findById(expert.userId).select({ name: 1 }).lean()
  const { _id, ...rest } = expert
  return json({ id: _id, ...rest, name: owner?.name })
}

// ---------- Appointments ----------
export async function handleAppointmentBook(request) {
  let session = await getServerSession(authOptions)
  await connectDB()
  const body = await request.json().catch(() => ({}))

  let clientId = session?.user?.id
  if (!session?.user) {
    const guest = body?.guest || {}
    const gEmail = String(guest.email || '').trim().toLowerCase()
    const gName = String(guest.name || '').trim()
    const gPhone = String(guest.phone || '').trim()
    if (!gEmail || !gName) return err('للحجز كضيف، الاسم والبريد الإلكتروني مطلوبان', 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail)) return err('صيغة البريد الإلكتروني غير صحيحة', 400)
    let existingUser = await User.findOne({ email: gEmail })
    if (existingUser && existingUser.password && !existingUser.isGuest) {
      return err('هذا البريد مسجّل مسبقاً، يُرجى تسجيل الدخول لإتمام الحجز', 409)
    }
    if (existingUser) {
      clientId = existingUser._id
      if (gName && !existingUser.name) existingUser.name = gName
      if (gPhone && !existingUser.phone) existingUser.phone = gPhone
      await existingUser.save()
    } else {
      const guestUser = await User.create({
        name: gName,
        email: gEmail,
        password: '',
        phone: gPhone,
        role: 'MEMBER',
        membershipTier: 'FREE',
        isGuest: true,
      })
      clientId = guestUser._id
    }
    session = { user: { id: clientId, role: 'MEMBER' } }
  }

  const { expertId, date, startTime, endTime } = body || {}
  if (!expertId || !date || !startTime || !endTime) return err('بيانات الحجز ناقصة', 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('تاريخ غير صحيح', 400)
  const expert = await Expert.findById(expertId).lean()
  if (!expert || expert.status !== 'APPROVED') return err('الخبير غير متاح', 404)
  if (expert.userId === clientId) return err('لا يمكنك حجز جلسة مع نفسك', 400)

  const day = new Date(date + 'T00:00:00.000Z')
  const dayOfWeek = day.getUTCDay()
  const availOk = await Availability.findOne({
    expertId,
    dayOfWeek,
    startTime: { $lte: startTime },
    endTime: { $gte: endTime },
  }).lean()
  if (!availOk) return err('الوقت غير ضمن أوقات المتاحة', 400)

  const dayEnd = new Date(day)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  const conflict = await Appointment.findOne({
    expertId,
    status: { $in: ['CONFIRMED', 'PENDING'] },
    date: { $gte: day, $lt: dayEnd },
    startTime,
  }).lean()
  if (conflict) return err('هذا الموعد محجوز بالفعل', 409)

  const client = await User.findById(clientId).lean()
  const clientTier = client?.membershipTier || 'FREE'
  const price = computeSessionPrice(expert.hourlyRate, TIER_DISCOUNT[clientTier] || 0)
  // Platform commission — same 5% policy as store orders (see COMMISSION_PERCENT).
  // Applied on the final (post-discount) amount that the client actually pays.
  const commissionAmount = +(price.finalPrice * (COMMISSION_PERCENT / 100)).toFixed(3)
  const expertNetAmount = +(price.finalPrice - commissionAmount).toFixed(3)
  const appt = await Appointment.create({
    clientId,
    expertId,
    date: day,
    startTime,
    endTime,
    status: 'CONFIRMED',
    totalPaid: price.finalPrice,
    originalPrice: price.originalPrice,
    discountPercent: price.discountPercent,
    commissionPercent: COMMISSION_PERCENT,
    commissionAmount,
    expertNetAmount,
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

  return json({
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
}

export async function handleAppointmentsList(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const url = new URL(request.url)
  const as = url.searchParams.get('as') || 'client'
  const q = {}
  if (as === 'expert') {
    const expert = await Expert.findOne({ userId: session.user.id }).lean()
    if (!expert) return json({ appointments: [] })
    q.expertId = expert._id
  } else {
    q.clientId = session.user.id
  }
  const appts = await Appointment.find(q)
    .sort({ date: -1, startTime: -1 })
    .lean()
  return json({
    appointments: appts.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
  })
}

export async function handleAppointmentCancel(id) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const appt = await Appointment.findById(id)
  if (!appt) return err('الحجز غير موجود', 404)
  let isExpert = false
  if (appt.clientId !== session.user.id) {
    const expert = await Expert.findById(appt.expertId).lean()
    if (expert?.userId === session.user.id) isExpert = true
    else if (session.user.role !== 'ADMIN') return err('غير مصرح', 403)
  }
  if (appt.status === 'CANCELLED') return err('الحجز ملغي مسبقاً', 400)
  if (!isExpert && session.user.role !== 'ADMIN') {
    const d = new Date(appt.date)
    const [h, m] = appt.startTime.split(':').map(Number)
    d.setUTCHours(h, m, 0, 0)
    const hoursUntil = (d.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntil < 24) return err('لا يمكن الإلغاء قبل الجلسة بأقل من 24 ساعة', 400)
  }
  appt.status = 'CANCELLED'
  appt.cancelledAt = new Date()
  appt.cancelledBy = isExpert
    ? 'expert'
    : session.user.role === 'ADMIN'
    ? 'admin'
    : 'client'
  await appt.save()

  try {
    const client = await User.findById(appt.clientId).select({ email: 1, name: 1 }).lean()
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
  return json({ success: true })
}

export async function handleAppointmentReview(id, request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  const body = await request.json().catch(() => ({}))
  const rating = Number(body?.rating)
  const comment = (body?.comment || '').toString().slice(0, 1000)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return err('التقييم يجب أن يكون بين 1 و 5 نجوم', 400)
  }
  await connectDB()
  const appt = await Appointment.findById(id)
  if (!appt) return err('الحجز غير موجود', 404)
  if (appt.clientId !== session.user.id) return err('لا يمكنك تقييم جلسة ليست لك', 403)

  const apptEnd = new Date(appt.date)
  const [eh, em] = (appt.endTime || '00:00').split(':').map(Number)
  apptEnd.setUTCHours(eh, em, 0, 0)
  if (apptEnd > new Date()) return err('لا يمكن التقييم قبل انتهاء الجلسة', 400)
  if (appt.status === 'CANCELLED') return err('لا يمكن تقييم جلسة ملغاة', 400)
  if (appt.reviewedAt) return err('لقد قمت بتقييم هذه الجلسة مسبقاً', 409)

  appt.rating = rating
  appt.reviewComment = comment
  appt.reviewedAt = new Date()
  if (appt.status === 'CONFIRMED') appt.status = 'COMPLETED'
  await appt.save()

  const agg = await Appointment.aggregate([
    { $match: { expertId: appt.expertId, rating: { $gte: 1 } } },
    { $group: { _id: '$expertId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
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
  return json({
    success: true,
    appointment: { id: appt._id, rating, comment, status: appt.status },
  })
}

// ---------- Admin: experts ----------
export async function handleAdminExpertsList(request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'PENDING').toUpperCase()
  await connectDB()
  const q = status === 'ALL' ? {} : { status }
  const list = await Expert.find(q).sort({ createdAt: -1 }).lean()
  return json({
    experts: list.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
  })
}

export async function handleAdminExpertApprove(id) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
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
  if (!updated) return err('الخبير غير موجود', 404)
  await User.findByIdAndUpdate(updated.userId, { role: 'EXPERT' })
  return json({ success: true, status: updated.status })
}

export async function handleAdminExpertReject(id, request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  const body = await request.json().catch(() => ({}))
  const reason = (body?.reason || '').trim()
  if (!reason) return err('سبب الرفض مطلوب', 400)
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
  if (!updated) return err('الخبير غير موجود', 404)
  return json({ success: true, status: updated.status })
}


/**
 * GET /expert/earnings — returns the aggregated earnings summary + monthly
 * breakdown for the logged-in expert (only if they own an Expert profile).
 * Read-only. Data comes from Appointment (already includes commission fields).
 */
export async function handleExpertEarnings() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()

  const expert = await Expert.findOne({ userId: session.user.id }).lean()
  if (!expert) return err('لم نعثر على ملف خبير مرتبط بحسابك', 404)

  // Include all statuses except CANCELLED, because CONFIRMED/COMPLETED both
  // represent a real booking that generated revenue.
  const matchQ = {
    expertId: expert._id,
    status: { $in: ['CONFIRMED', 'COMPLETED'] },
  }

  const [totals] = await Appointment.aggregate([
    { $match: matchQ },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
        },
        upcomingSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] },
        },
        gross: { $sum: { $ifNull: ['$totalPaid', 0] } },
        commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        net: { $sum: { $ifNull: ['$expertNetAmount', 0] } },
      },
    },
  ])

  // Monthly breakdown (last 12 months)
  const monthly = await Appointment.aggregate([
    { $match: matchQ },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
        sessions: { $sum: 1 },
        gross: { $sum: { $ifNull: ['$totalPaid', 0] } },
        commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        net: { $sum: { $ifNull: ['$expertNetAmount', 0] } },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 },
  ])

  const round = (n) => +(Number(n) || 0).toFixed(3)

  return json({
    summary: {
      sessions: totals?.sessions || 0,
      completedSessions: totals?.completedSessions || 0,
      upcomingSessions: totals?.upcomingSessions || 0,
      gross: round(totals?.gross),
      commission: round(totals?.commission),
      net: round(totals?.net),
      commissionPercent: COMMISSION_PERCENT,
    },
    monthly: monthly.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      sessions: m.sessions,
      gross: round(m.gross),
      commission: round(m.commission),
      net: round(m.net),
    })),
  })
}
