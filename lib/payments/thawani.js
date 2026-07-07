/**
 * Thawani Pay client & helpers.
 *
 * Docs: https://thawani-technologies.stoplight.io/docs/thawani-ecommerce-api
 * Env:
 *   THAWANI_BASE_URL       — https://uatcheckout.thawani.om/api/v1 (test) or https://checkout.thawani.om/api/v1 (prod)
 *   THAWANI_SECRET_KEY     — used in `thawani-api-key` header
 *   THAWANI_WEBHOOK_SECRET — used for HMAC-SHA256 signature verification
 *
 * Note: Thawani accepts & returns amounts in BAISA (1 OMR = 1000 baisa).
 */
import crypto from 'crypto'

const BASE = process.env.THAWANI_BASE_URL || 'https://uatcheckout.thawani.om/api/v1'

export function isThawaniEnabled() {
  // Consider Thawani active whenever the essential keys are present.
  // (Historically required PAYMENT_PROVIDER=thawani, but that env var was
  //  easy to forget on deploy and caused silent "free activation" bugs.)
  return (
    !!process.env.THAWANI_SECRET_KEY &&
    !!process.env.THAWANI_BASE_URL &&
    (process.env.PAYMENT_PROVIDER || 'thawani').toLowerCase() !== 'mock'
  )
}

export const omrToBaisa = (omr) => Math.round(Number(omr || 0) * 1000)
export const baisaToOmr = (baisa) => +(Number(baisa || 0) / 1000).toFixed(3)

async function thawaniFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'thawani-api-key': process.env.THAWANI_SECRET_KEY || '',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data }
}

/**
 * Create a Thawani checkout session with multiple product line items.
 * @param {Object} opts
 * @param {string} opts.clientReferenceId
 * @param {Array<{name:string, quantity:number, unitAmountOmr:number}>} opts.products
 * @param {string} opts.successUrl
 * @param {string} opts.cancelUrl
 * @param {Object} [opts.metadata]
 */
export async function createCheckoutSession({
  clientReferenceId,
  products,
  successUrl,
  cancelUrl,
  metadata = {},
}) {
  const payload = {
    client_reference_id: clientReferenceId,
    mode: 'payment',
    products: products.map((p) => ({
      name: String(p.name || 'منتج').slice(0, 40),
      quantity: Math.max(1, Math.min(1000, parseInt(p.quantity || 1, 10))),
      unit_amount: omrToBaisa(p.unitAmountOmr),
    })),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  }
  const r = await thawaniFetch('/checkout/session', {
    method: 'POST',
    body: payload,
  })
  if (!r.ok || !r.data?.data?.session_id) {
    return {
      ok: false,
      status: r.status,
      data: r.data,
      error:
        r.data?.description ||
        r.data?.detail ||
        'تعذّر إنشاء جلسة الدفع (Thawani)',
    }
  }
  const s = r.data.data
  const publishable = process.env.NEXT_PUBLIC_THAWANI_PUBLISHABLE_KEY || ''
  const checkoutDomain = BASE.replace('/api/v1', '')
  const redirectUrl = `${checkoutDomain}/pay/${s.session_id}?key=${publishable}`
  return {
    ok: true,
    status: 200,
    sessionId: s.session_id,
    invoice: s.invoice,
    redirectUrl,
    data: s,
  }
}

/** Retrieve a session to check payment_status (paid | unpaid | cancelled). */
export async function getCheckoutSession(sessionId) {
  const r = await thawaniFetch(`/checkout/session/${sessionId}`)
  if (!r.ok) return { ok: false, status: r.status, data: r.data }
  const s = r.data?.data
  return {
    ok: true,
    status: 200,
    sessionId: s?.session_id,
    paymentStatus: s?.payment_status,
    clientReferenceId: s?.client_reference_id,
    totalAmount: s?.total_amount,
    currency: s?.currency,
    invoice: s?.invoice,
    metadata: s?.metadata || {},
    data: s,
  }
}

/**
 * Verify HMAC-SHA256 signature of a Thawani webhook.
 * Signature = HMAC_SHA256( rawBody + "-" + timestamp, webhook_secret ), hex.
 */
export function verifyWebhookSignature(rawBody, timestamp, signature) {
  const secret = process.env.THAWANI_WEBHOOK_SECRET || ''
  if (!secret || !signature || !timestamp) return false
  const text = `${rawBody}-${timestamp}`
  const expected = crypto
    .createHmac('sha256', Buffer.from(secret, 'ascii'))
    .update(Buffer.from(text, 'ascii'))
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}

/* ---------- Legacy helpers for backward compat (pre-refactor callers) ---------- */
export async function verifyAndCapture({ sessionId }) {
  const r = await getCheckoutSession(sessionId)
  if (!r.ok) return { status: 'FAILED', metadata: {} }
  return {
    status:
      r.paymentStatus === 'paid'
        ? 'PAID'
        : r.paymentStatus === 'unpaid'
          ? 'PENDING'
          : 'FAILED',
    metadata: r.metadata,
  }
}
