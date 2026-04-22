/**
 * Payment Adapter Layer — يدعم بوابات دفع متعددة
 * ================================================
 *
 * الهدف: أجزاء التطبيق لا تعرف بأي بوابة دفع نستخدمها.
 * تريد التبديل من MOCK إلى ثواني؟ غيّر PAYMENT_PROVIDER في .env واكتب
 * تنفيذ دالّتين فط في /app/lib/payments/thawani.js
 *
 * أي بوابة دفع يجب أن تنفّذ الواجهة التالية:
 *
 *   createCheckoutSession({ amount, currency, metadata, successUrl, cancelUrl })
 *     -> { sessionId, checkoutUrl, immediatelyPaid: boolean }
 *
 *   verifyAndCapture({ sessionId, rawRequest? })
 *     -> { status: 'PAID' | 'PENDING' | 'FAILED', metadata }
 *
 *   parseWebhook(request)
 *     -> { sessionId, status, metadata } | null
 */

import * as mockProvider from './mock'
import * as thawaniProvider from './thawani'

const PROVIDERS = {
  mock: mockProvider,
  thawani: thawaniProvider,
  // stripe: stripeProvider, // يمكن إضافته لاحقاً
}

export function getPaymentProvider() {
  const key = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase()
  const provider = PROVIDERS[key]
  if (!provider) {
    console.warn(
      `[payments] Unknown PAYMENT_PROVIDER='${key}', falling back to mock`
    )
    return { name: 'mock', ...mockProvider }
  }
  return { name: key, ...provider }
}

export const isRealPayment = () =>
  (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase() !== 'mock'
