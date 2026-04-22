/**
 * Thawani Payment Gateway Adapter (Oman)
 * ======================================
 * مطابقة لمواصفات Thawani Hosted Checkout API
 * https://docs.thawani.om
 *
 * TODO قبل التفعيل:
 *   1. أنشئ حساب تجاري في https://merchant.thawani.om
 *   2. أضف هذه المتغيرات في .env:
 *        PAYMENT_PROVIDER=thawani
 *        THAWANI_SECRET_KEY=<مفتاح المتاجر>
 *        THAWANI_PUBLISHABLE_KEY=<مفتاح النشر>
 *        THAWANI_BASE_URL=https://uatcheckout.thawani.om/api/v1   # أو إنتاج
 *   3. أضف Webhook URL في لوحة تحكم ثواني:
 *        {NEXT_PUBLIC_BASE_URL}/api/payments/webhook
 *   4. الأسعار لدينا بالريال العماني. ثواني تتوقع المبالغ بالبيسات:
 *        1 OMR = 1000 baisa. التحويل يتم أدناه تلقائياً.
 */

const BASE_URL = process.env.THAWANI_BASE_URL || 'https://uatcheckout.thawani.om/api/v1'
const SECRET = process.env.THAWANI_SECRET_KEY
const PUBLISHABLE = process.env.THAWANI_PUBLISHABLE_KEY

function omrToBaisa(omr) {
  return Math.round(Number(omr) * 1000)
}

function assertConfigured() {
  if (!SECRET) {
    throw new Error(
      '[thawani] THAWANI_SECRET_KEY مفقود في .env — لا يمكن إنشاء جلسة دفع'
    )
  }
}

export async function createCheckoutSession({
  amount,
  currency,
  metadata,
  successUrl,
  cancelUrl,
}) {
  assertConfigured()
  if ((currency || 'OMR').toUpperCase() !== 'OMR') {
    throw new Error('[thawani] currency must be OMR')
  }

  const payload = {
    client_reference_id: metadata?.referenceId || `ref_${Date.now()}`,
    mode: 'payment',
    products: [
      {
        name: metadata?.itemName || 'Majles Service',
        quantity: 1,
        unit_amount: omrToBaisa(amount),
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: metadata || {},
  }

  const res = await fetch(`${BASE_URL}/checkout/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'thawani-api-key': SECRET,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || !data?.data?.session_id) {
    throw new Error(
      `[thawani] createCheckoutSession failed: ${JSON.stringify(data)}`
    )
  }
  const sessionId = data.data.session_id
  const checkoutUrl = `${BASE_URL.replace('/api/v1', '')}/pay/${sessionId}?key=${PUBLISHABLE}`

  return {
    sessionId,
    checkoutUrl,
    immediatelyPaid: false,
    provider: 'thawani',
    amount,
    currency: 'OMR',
    metadata,
  }
}

export async function verifyAndCapture({ sessionId }) {
  assertConfigured()
  const res = await fetch(`${BASE_URL}/checkout/session/${sessionId}`, {
    headers: { 'thawani-api-key': SECRET },
  })
  const data = await res.json()
  const status = data?.data?.payment_status
  return {
    status:
      status === 'paid' ? 'PAID' : status === 'unpaid' ? 'PENDING' : 'FAILED',
    metadata: data?.data?.metadata || {},
  }
}

export async function parseWebhook(request) {
  // ثواني ترسل إشعارات بصيغة JSON. التحقق من التوقيع يتم حسب وثائقهم.
  const body = await request.json().catch(() => null)
  if (!body) return null
  const sessionId = body?.data?.session_id
  const paymentStatus = body?.data?.payment_status
  if (!sessionId) return null
  return {
    sessionId,
    status:
      paymentStatus === 'paid' ? 'PAID' : paymentStatus === 'unpaid' ? 'PENDING' : 'FAILED',
    metadata: body?.data?.metadata || {},
  }
}
