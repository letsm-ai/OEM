/**
 * MOCK payment provider — التعامل يحدث فوراً بدون دفع حقيقي.
 * أي جلسة تعتبر PAID بعد الإنشاء مباشرة.
 */

import { v4 as uuidv4 } from 'uuid'

export async function createCheckoutSession({
  amount,
  currency,
  metadata,
  successUrl,
}) {
  const sessionId = `mock_${uuidv4()}`
  return {
    sessionId,
    checkoutUrl: successUrl || null,
    immediatelyPaid: true,
    provider: 'mock',
    amount,
    currency,
    metadata,
  }
}

export async function verifyAndCapture({ sessionId }) {
  return { status: 'PAID', metadata: { sessionId } }
}

export async function parseWebhook() {
  return null
}
