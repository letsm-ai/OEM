/**
 * Jobs / Employment API handlers.
 *
 * Roles:
 *   - PUBLIC (anonymous or logged-in) can list & view jobs.
 *   - JOB SEEKER (any logged-in MEMBER) can manage their profile & apply.
 *   - EMPLOYER (any user that OWNS a Company in the directory) can post jobs
 *     & view/manage applicants.
 *   - ADMIN can manage all jobs.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  JobPosting,
  JobSeeker,
  JobApplication,
  Company,
  User,
  JOB_CONSTANTS,
} from '@/lib/models'

const DEFAULT_DEADLINE_DAYS = 30
const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false
  // Accept UUID format (36 chars with dashes) or MongoDB ObjectId (24 hex chars)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const objectIdRegex = /^[0-9a-f]{24}$/i
  return uuidRegex.test(id) || objectIdRegex.test(id)
}
const err = (msg, code = 400, extras = {}) =>
  NextResponse.json({ error: msg, ...extras }, { status: code })
const ok = (data) => NextResponse.json(data)

/* ---------------- Helpers ---------------- */

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'UNAUTHORIZED', status: 401 }
  return { session }
}

async function requireCompanyOwner(session) {
  await connectDB()
  const companies = await Company.find({ userId: session.user.id })
    .select('_id nameAr logo')
    .lean()
  if (companies.length === 0) {
    return {
      error:
        'يجب أن تسجّل شركتك في دليل الشركات أولاً لتنشر إعلانات الوظائف',
      status: 403,
      code: 'NO_COMPANY',
    }
  }
  return { companies }
}

function computeStatus(job) {
  if (job.status === 'CLOSED' || job.status === 'DRAFT') return job.status
  if (job.applyDeadline && new Date(job.applyDeadline) < new Date()) return 'EXPIRED'
  return 'ACTIVE'
}

function serializeJob(j) {
  return {
    id: String(j._id),
    companyId: String(j.companyId),
    companyNameAr: j.companyNameAr || '',
    companyLogo: j.companyLogo || '',
    titleAr: j.titleAr,
    titleEn: j.titleEn || '',
    descriptionAr: j.descriptionAr,
    descriptionEn: j.descriptionEn || '',
    sector: j.sector,
    governorate: j.governorate,
    city: j.city || '',
    employmentType: j.employmentType,
    workMode: j.workMode,
    experienceLevel: j.experienceLevel,
    salaryMin: j.salaryMin || 0,
    salaryMax: j.salaryMax || 0,
    salaryHidden: !!j.salaryHidden,
    salaryCurrency: j.salaryCurrency || 'OMR',
    requirements: j.requirements || [],
    responsibilities: j.responsibilities || [],
    benefits: j.benefits || [],
    skills: j.skills || [],
    applyDeadline: j.applyDeadline,
    status: computeStatus(j),
    views: j.views || 0,
    applicantsCount: j.applicantsCount || 0,
    featured: !!j.featured,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  }
}

function serializeSeeker(s) {
  if (!s) return null
  return {
    id: String(s._id),
    userId: String(s.userId),
    fullName: s.fullName,
    title: s.title || '',
    bio: s.bio || '',
    photo: s.photo || '',
    yearsOfExperience: s.yearsOfExperience || 0,
    currentPosition: s.currentPosition || '',
    currentCompany: s.currentCompany || '',
    desiredSectors: s.desiredSectors || [],
    desiredGovernorates: s.desiredGovernorates || [],
    workModePref: s.workModePref || [],
    employmentTypePref: s.employmentTypePref || [],
    educationLevel: s.educationLevel || '',
    educationSummary: s.educationSummary || '',
    experience: s.experience || [],
    skills: s.skills || [],
    languages: s.languages || [],
    links: s.links || [],
    phone: s.phone || '',
    email: s.email || '',
    openToWork: !!s.openToWork,
    profileVisibility: s.profileVisibility || 'PUBLIC',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

function serializeApplication(a, jobDoc = null) {
  return {
    id: String(a._id),
    jobId: String(a.jobId),
    seekerUserId: String(a.seekerUserId),
    companyId: String(a.companyId),
    seekerSnapshot: a.seekerSnapshot || {},
    coverLetter: a.coverLetter || '',
    status: a.status,
    employerViewedAt: a.employerViewedAt,
    employerNotes: a.employerNotes || '',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    job: jobDoc ? serializeJob(jobDoc) : undefined,
  }
}

/* ================================================================== */
/*                       PUBLIC JOB LIST & DETAIL                       */
/* ================================================================== */

/** GET /api/jobs — public listing with filters */
export async function handleJobsList(request) {
  await connectDB()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(6, parseInt(searchParams.get('limit') || '12', 10)))
  const skip = (page - 1) * limit
  const q = (searchParams.get('q') || '').trim()
  const sector = searchParams.get('sector') || ''
  const governorate = searchParams.get('governorate') || ''
  const employmentType = searchParams.get('employmentType') || ''
  const workMode = searchParams.get('workMode') || ''
  const experienceLevel = searchParams.get('experienceLevel') || ''

  const filter = {
    status: 'ACTIVE',
    $or: [
      { applyDeadline: { $gte: new Date() } },
      { applyDeadline: { $exists: false } },
      { applyDeadline: null },
    ],
  }
  if (sector) filter.sector = sector
  if (governorate) filter.governorate = governorate
  if (employmentType) filter.employmentType = employmentType
  if (workMode) filter.workMode = workMode
  if (experienceLevel) filter.experienceLevel = experienceLevel
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$and = [
      { $or: [{ titleAr: rx }, { descriptionAr: rx }, { skills: rx }, { companyNameAr: rx }] },
    ]
  }

  const [items, total] = await Promise.all([
    JobPosting.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JobPosting.countDocuments(filter),
  ])

  return ok({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    items: items.map(serializeJob),
  })
}

/** GET /api/jobs/:id — public detail (also increments view counter) */
export async function handleJobDetail(request, { params }) {
  await connectDB()
  const { id } = params || {}
  if (!isValidObjectId(id)) return err('معرّف غير صحيح', 400)
  const job = await JobPosting.findById(id).lean()
  if (!job) return err('الوظيفة غير موجودة', 404)
  // Fire-and-forget view increment (skip if user is the poster)
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || String(session.user.id) !== String(job.postedBy)) {
    JobPosting.updateOne({ _id: id }, { $inc: { views: 1 } }).catch(() => {})
  }
  // Also expose whether the current logged-in user already applied
  let alreadyApplied = false
  if (session?.user?.id) {
    alreadyApplied = !!(await JobApplication.exists({
      jobId: id,
      seekerUserId: session.user.id,
    }))
  }
  return ok({ job: serializeJob(job), alreadyApplied })
}

/** POST /api/jobs/:id/apply — job seeker applies */
export async function handleJobApply(request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  const session = auth.session
  const { id } = params || {}
  if (!isValidObjectId(id)) return err('معرّف غير صحيح', 400)

  await connectDB()
  const job = await JobPosting.findById(id).lean()
  if (!job) return err('الوظيفة غير موجودة', 404)
  const currentStatus = computeStatus(job)
  if (currentStatus !== 'ACTIVE') {
    return err('باب التقديم على هذه الوظيفة مغلق', 400)
  }
  // Employer can't apply to their own posting
  if (String(job.postedBy) === String(session.user.id)) {
    return err('لا يمكنك التقديم على وظيفة نشرتها بنفسك', 400)
  }

  // Load the seeker profile — REQUIRED to apply
  const seeker = await JobSeeker.findOne({ userId: session.user.id }).lean()
  if (!seeker || !seeker.fullName || !seeker.title) {
    return err(
      'يجب استكمال ملفك المهني (الاسم، المسمى الوظيفي على الأقل) قبل التقديم',
      400,
      { code: 'PROFILE_INCOMPLETE' }
    )
  }

  const body = await request.json().catch(() => ({}))
  const coverLetter = String(body?.coverLetter || '').slice(0, 1500)

  const seekerSnapshot = {
    fullName: seeker.fullName,
    title: seeker.title,
    bio: seeker.bio,
    photo: seeker.photo,
    yearsOfExperience: seeker.yearsOfExperience,
    skills: seeker.skills || [],
    links: seeker.links || [],
    phone: seeker.phone,
    email: seeker.email,
  }

  try {
    const app = await JobApplication.create({
      jobId: job._id,
      seekerUserId: session.user.id,
      companyId: job.companyId,
      seekerSnapshot,
      coverLetter,
      status: 'SUBMITTED',
    })
    await JobPosting.updateOne(
      { _id: job._id },
      { $inc: { applicantsCount: 1 } }
    )
    return ok({ success: true, application: serializeApplication(app.toObject()) })
  } catch (e) {
    if (e?.code === 11000) {
      return err('لقد تقدّمت على هذه الوظيفة مسبقاً', 409, {
        code: 'DUPLICATE',
      })
    }
    console.error('[jobs/apply] failed:', e?.message)
    return err(e?.message || 'خطأ داخلي', 500)
  }
}

/* ================================================================== */
/*                     JOB SEEKER — MY PROFILE                          */
/* ================================================================== */

export async function handleSeekerGet() {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const seeker = await JobSeeker.findOne({ userId: auth.session.user.id }).lean()
  return ok({ profile: serializeSeeker(seeker) })
}

export async function handleSeekerUpsert(request) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const body = await request.json().catch(() => ({}))

  const user = await User.findById(auth.session.user.id).lean()
  if (!user) return err('المستخدم غير موجود', 404)

  // Whitelist fields
  const $set = {
    userId: auth.session.user.id,
    email: user.email,
  }
  const strFields = [
    'fullName',
    'title',
    'bio',
    'photo',
    'currentPosition',
    'currentCompany',
    'educationLevel',
    'educationSummary',
    'phone',
    'profileVisibility',
  ]
  for (const f of strFields) {
    if (typeof body[f] === 'string') $set[f] = body[f].trim()
  }
  if (Number.isFinite(Number(body.yearsOfExperience))) {
    $set.yearsOfExperience = Math.max(0, Math.min(60, Number(body.yearsOfExperience)))
  }
  if (typeof body.openToWork === 'boolean') $set.openToWork = body.openToWork

  const arrayFields = ['desiredSectors', 'desiredGovernorates', 'workModePref', 'employmentTypePref', 'skills', 'languages']
  for (const f of arrayFields) {
    if (Array.isArray(body[f])) {
      $set[f] = body[f].map((v) => String(v).trim()).filter(Boolean).slice(0, 30)
    }
  }
  // Experience list
  if (Array.isArray(body.experience)) {
    $set.experience = body.experience
      .filter((e) => e && e.title)
      .slice(0, 20)
      .map((e) => ({
        title: String(e.title || '').trim(),
        company: String(e.company || '').trim(),
        from: String(e.from || '').trim(),
        to: String(e.to || '').trim(),
        description: String(e.description || '').trim().slice(0, 500),
      }))
  }
  // Links
  if (Array.isArray(body.links)) {
    $set.links = body.links
      .filter((l) => l && l.url)
      .slice(0, 10)
      .map((l) => ({
        label: String(l.label || 'رابط').trim().slice(0, 40),
        url: String(l.url || '').trim().slice(0, 400),
      }))
  }

  if (!$set.fullName) {
    return err('الاسم الكامل مطلوب', 400)
  }

  const seeker = await JobSeeker.findOneAndUpdate(
    { userId: auth.session.user.id },
    { $set },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()

  return ok({ profile: serializeSeeker(seeker) })
}

/** GET /api/me/job-applications — my applications with job info */
export async function handleMyApplications() {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const apps = await JobApplication.find({ seekerUserId: auth.session.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
  const jobIds = apps.map((a) => a.jobId)
  const jobs = await JobPosting.find({ _id: { $in: jobIds } }).lean()
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]))
  return ok({
    items: apps.map((a) => serializeApplication(a, jobMap.get(String(a.jobId)))),
  })
}

/** DELETE /api/me/job-applications/:id — withdraw my application */
export async function handleWithdrawApplication(_request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  const { id } = params || {}
  if (!isValidObjectId(id)) return err('معرّف غير صحيح', 400)
  await connectDB()
  const app = await JobApplication.findById(id)
  if (!app) return err('التقديم غير موجود', 404)
  if (String(app.seekerUserId) !== String(auth.session.user.id)) {
    return err('غير مصرح', 403)
  }
  app.status = 'WITHDRAWN'
  await app.save()
  await JobPosting.updateOne({ _id: app.jobId }, { $inc: { applicantsCount: -1 } })
  return ok({ success: true })
}

/* ================================================================== */
/*                       EMPLOYER — MY POSTINGS                         */
/* ================================================================== */

export async function handleEmployerJobsList() {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  const ownerCheck = await requireCompanyOwner(auth.session)
  if (ownerCheck.error) return err(ownerCheck.error, ownerCheck.status, { code: ownerCheck.code })

  const jobs = await JobPosting.find({ postedBy: auth.session.user.id })
    .sort({ createdAt: -1 })
    .lean()
  return ok({
    companies: ownerCheck.companies.map((c) => ({
      id: String(c._id),
      nameAr: c.nameAr,
      logo: c.logo || '',
    })),
    items: jobs.map(serializeJob),
  })
}

export async function handleEmployerJobCreate(request) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  const ownerCheck = await requireCompanyOwner(auth.session)
  if (ownerCheck.error) return err(ownerCheck.error, ownerCheck.status, { code: ownerCheck.code })

  const body = await request.json().catch(() => ({}))
  const { companyId, titleAr, descriptionAr } = body || {}
  if (!isValidObjectId(companyId)) return err('يرجى اختيار شركة صحيحة', 400)
  const company = ownerCheck.companies.find((c) => String(c._id) === String(companyId))
  if (!company) return err('لا تملك هذه الشركة', 403)
  if (!titleAr || String(titleAr).trim().length < 4) return err('عنوان الوظيفة مطلوب', 400)
  if (!descriptionAr || String(descriptionAr).trim().length < 20) {
    return err('يجب كتابة وصف تفصيلي (20 حرف على الأقل)', 400)
  }
  if (!body.sector) return err('القطاع مطلوب', 400)
  if (!body.governorate) return err('المحافظة مطلوبة', 400)

  await connectDB()
  const now = new Date()
  const deadline = new Date(now.getTime() + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000)

  const job = await JobPosting.create({
    companyId,
    postedBy: auth.session.user.id,
    companyNameAr: company.nameAr,
    companyLogo: company.logo || '',
    titleAr: String(titleAr).trim(),
    titleEn: String(body.titleEn || '').trim(),
    descriptionAr: String(descriptionAr).trim(),
    descriptionEn: String(body.descriptionEn || '').trim(),
    sector: body.sector,
    governorate: body.governorate,
    city: String(body.city || '').trim(),
    employmentType: JOB_CONSTANTS.EMPLOYMENT_TYPES.includes(body.employmentType) ? body.employmentType : 'FULL_TIME',
    workMode: JOB_CONSTANTS.WORK_MODES.includes(body.workMode) ? body.workMode : 'ONSITE',
    experienceLevel: JOB_CONSTANTS.EXPERIENCE_LEVELS.includes(body.experienceLevel) ? body.experienceLevel : 'MID',
    salaryMin: Number(body.salaryMin) || 0,
    salaryMax: Number(body.salaryMax) || 0,
    salaryHidden: !!body.salaryHidden,
    requirements: Array.isArray(body.requirements) ? body.requirements.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
    responsibilities: Array.isArray(body.responsibilities) ? body.responsibilities.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
    benefits: Array.isArray(body.benefits) ? body.benefits.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
    skills: Array.isArray(body.skills) ? body.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 30) : [],
    applyDeadline: deadline,
    status: 'ACTIVE',
  })

  return ok({ success: true, job: serializeJob(job.toObject()) })
}

async function findOwnedJob(id, userId) {
  if (!isValidObjectId(id)) return null
  const job = await JobPosting.findById(id)
  if (!job) return null
  if (String(job.postedBy) !== String(userId)) return null
  return job
}

export async function handleEmployerJobUpdate(request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const job = await findOwnedJob(params?.id, auth.session.user.id)
  if (!job) return err('غير مصرح أو الوظيفة غير موجودة', 404)
  const body = await request.json().catch(() => ({}))
  const editable = [
    'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn',
    'sector', 'governorate', 'city',
    'employmentType', 'workMode', 'experienceLevel',
    'salaryMin', 'salaryMax', 'salaryHidden',
    'requirements', 'responsibilities', 'benefits', 'skills',
  ]
  for (const k of editable) {
    if (k in body) job[k] = body[k]
  }
  if (body.status && ['ACTIVE', 'CLOSED', 'DRAFT'].includes(body.status)) {
    job.status = body.status
  }
  await job.save()
  return ok({ success: true, job: serializeJob(job.toObject()) })
}

export async function handleEmployerJobDelete(_request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const job = await findOwnedJob(params?.id, auth.session.user.id)
  if (!job) return err('غير مصرح أو الوظيفة غير موجودة', 404)
  await JobPosting.deleteOne({ _id: job._id })
  await JobApplication.deleteMany({ jobId: job._id })
  return ok({ success: true })
}

export async function handleEmployerJobExtend(_request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const job = await findOwnedJob(params?.id, auth.session.user.id)
  if (!job) return err('غير مصرح أو الوظيفة غير موجودة', 404)
  const base = job.applyDeadline && new Date(job.applyDeadline) > new Date()
    ? new Date(job.applyDeadline)
    : new Date()
  job.applyDeadline = new Date(base.getTime() + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000)
  if (job.status === 'EXPIRED') job.status = 'ACTIVE'
  await job.save()
  return ok({ success: true, job: serializeJob(job.toObject()) })
}

export async function handleEmployerApplicantsList(_request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  await connectDB()
  const job = await findOwnedJob(params?.id, auth.session.user.id)
  if (!job) return err('غير مصرح أو الوظيفة غير موجودة', 404)
  const apps = await JobApplication.find({ jobId: job._id })
    .sort({ createdAt: -1 })
    .lean()
  return ok({
    job: serializeJob(job.toObject()),
    items: apps.map((a) => serializeApplication(a)),
  })
}

export async function handleEmployerApplicationUpdate(request, { params }) {
  const auth = await requireSession()
  if (auth.error) return err(auth.error, auth.status)
  const { id } = params || {}
  if (!isValidObjectId(id)) return err('معرّف غير صحيح', 400)
  await connectDB()
  const app = await JobApplication.findById(id)
  if (!app) return err('التقديم غير موجود', 404)
  // Ensure the employer owns the job
  const job = await JobPosting.findById(app.jobId)
  if (!job || String(job.postedBy) !== String(auth.session.user.id)) {
    return err('غير مصرح', 403)
  }
  const body = await request.json().catch(() => ({}))
  const allowedStatuses = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'REJECTED', 'HIRED']
  if (body.status && allowedStatuses.includes(body.status)) {
    if (app.status !== body.status) {
      app.status = body.status
      if (body.status !== 'SUBMITTED' && !app.employerViewedAt) {
        app.employerViewedAt = new Date()
      }
    }
  }
  if (typeof body.employerNotes === 'string') {
    app.employerNotes = body.employerNotes.slice(0, 1000)
  }
  await app.save()
  return ok({ success: true, application: serializeApplication(app.toObject()) })
}
