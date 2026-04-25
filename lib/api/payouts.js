/**
 * Vendor payouts and admin payout management.
 *   GET  /vendor/payouts
 *   POST /vendor/payouts
 *   GET  /admin/payouts?status=
 *   POST /admin/payouts/:id/(approve|reject|mark-paid)
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, PayoutRequest } from '@/lib/models'
import { computeVendorBalance, MIN_PAYOUT_AMOUNT } from '@/lib/payouts'
import { json, err, requireAuth, requireRole } from './_helpers'

async function ensureVendor(session) {
  const unauth = requireAuth(session)
  if (unauth) return { error: unauth, dbUser: null }
  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  if (!dbUser || (dbUser.role !== 'VENDOR' && dbUser.role !== 'ADMIN')) {
    return { error: err('صلاحيات بائع مطلوبة', 403), dbUser: null }
  }
  return { error: null, dbUser }
}

export async function handleVendorPayoutsList() {
  const session = await getServerSession(authOptions)
  const { error } = await ensureVendor(session)
  if (error) return error
  const balance = await computeVendorBalance(session.user.id)
  const requests = await PayoutRequest.find({ vendorId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  return json({
    balance,
    requests: requests.map((r) => ({ id: r._id, ...r, _id: undefined })),
  })
}

export async function handleVendorPayoutCreate(request) {
  const session = await getServerSession(authOptions)
  const { error, dbUser } = await ensureVendor(session)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const amount = Number(body?.amount)
  const bank = body?.bankDetails || {}
  const accountHolderName = String(bank.accountHolderName || '').trim()
  const bankName = String(bank.bankName || '').trim()
  const iban = String(bank.iban || '').replace(/\s+/g, '').toUpperCase()

  if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
    return err(`الحد الأدنى لطلب السحب هو ${MIN_PAYOUT_AMOUNT} ر.ع`, 400)
  }
  if (!accountHolderName) return err('اسم صاحب الحساب مطلوب', 400)
  if (!bankName) return err('اسم البنك مطلوب', 400)
  if (!/^OM\d{2}[A-Z0-9]{16}$/.test(iban)) {
    return err('رقم IBAN غير صالح (يجب أن يبدأ بـ OM ويحتوي على 20 خانة)', 400)
  }

  const balance = await computeVendorBalance(session.user.id)
  if (amount > balance.availableBalance) {
    return err(`الرصيد المتاح للسحب هو ${balance.availableBalance} ر.ع فقط`, 400)
  }

  const req = await PayoutRequest.create({
    vendorId: session.user.id,
    vendorName: dbUser.name || '',
    amountRequested: +amount.toFixed(3),
    bankDetails: {
      accountHolderName,
      bankName,
      iban,
      note: String(bank.note || '').slice(0, 300),
    },
    status: 'PENDING',
    requestedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return json({
    request: { id: req._id, ...req.toObject(), _id: undefined },
  })
}

export async function handleAdminPayoutsList(request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const q = status ? { status } : {}
  const requests = await PayoutRequest.find(q)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
  return json({
    requests: requests.map((r) => ({ id: r._id, ...r, _id: undefined })),
  })
}

export async function handleAdminPayoutAction(id, action, request) {
  const session = await getServerSession(authOptions)
  const role = requireRole(session, ['ADMIN'])
  if (role) return role
  await connectDB()
  const req = await PayoutRequest.findById(id)
  if (!req) return err('الطلب غير موجود', 404)
  const body = await request.json().catch(() => ({}))
  const admin = await User.findById(session.user.id).lean()

  if (action === 'approve') {
    if (req.status !== 'PENDING') return err('لا يمكن الموافقة على طلب ليس قيد الانتظار', 400)
    req.status = 'APPROVED'
    req.adminId = session.user.id
    req.adminName = admin?.name || ''
    req.processedAt = new Date()
  } else if (action === 'reject') {
    if (req.status !== 'PENDING') return err('لا يمكن رفض طلب ليس قيد الانتظار', 400)
    const reason = String(body?.reason || '').trim()
    if (!reason) return err('سبب الرفض مطلوب', 400)
    req.status = 'REJECTED'
    req.rejectionReason = reason.slice(0, 500)
    req.adminId = session.user.id
    req.adminName = admin?.name || ''
    req.processedAt = new Date()
  } else if (action === 'mark-paid') {
    if (req.status !== 'APPROVED') return err('يجب الموافقة على الطلب أولاً', 400)
    const ref = String(body?.transferReference || '').trim()
    if (!ref) return err('مرجع التحويل البنكي مطلوب', 400)
    req.status = 'PAID'
    req.transferReference = ref.slice(0, 100)
    req.adminId = session.user.id
    req.adminName = admin?.name || ''
  }
  req.updatedAt = new Date()
  await req.save()
  return json({
    request: { id: req._id, ...req.toObject(), _id: undefined },
  })
}
