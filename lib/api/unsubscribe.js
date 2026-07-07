/**
 * Public /api/unsubscribe endpoints.
 *   GET  /api/unsubscribe?email=&t=  → one-click (Gmail button). Stores opt-out
 *                                       and returns a small HTML "you have been
 *                                       unsubscribed" page.
 *   POST /api/unsubscribe            → JSON { email, reason? }. Called by the
 *                                       /unsubscribe landing page.
 *   POST /api/unsubscribe (Gmail's List-Unsubscribe-Post=One-Click) is also
 *   handled here — Gmail submits form-urlencoded `List-Unsubscribe=One-Click`.
 *
 * Signed tokens: to prevent someone from unsubscribing another user, the
 * email link contains an HMAC token derived from RESEND_API_KEY (or
 * NEXTAUTH_SECRET as a fallback). Tokens have no expiry — unsubscribe should
 * always work.
 */
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { EmailOptOut } from '@/lib/models'

const SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.RESEND_API_KEY ||
  'majles-unsubscribe-fallback'

export function signUnsubToken(email) {
  const h = crypto.createHmac('sha256', SECRET)
  h.update(String(email || '').toLowerCase().trim())
  // 12-char slug is plenty for a link people paste into an email
  return h.digest('hex').slice(0, 12)
}

function verify(email, token) {
  if (!email || !token) return false
  return signUnsubToken(email) === String(token).toLowerCase()
}

async function record({ email, source, reason = '', request }) {
  const clean = String(email || '').toLowerCase().trim()
  if (!clean || !clean.includes('@')) return { ok: false, error: 'invalid_email' }
  await connectDB()
  const userAgent = request?.headers?.get?.('user-agent') || ''
  const ip =
    request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    request?.headers?.get?.('x-real-ip') ||
    ''
  await EmailOptOut.updateOne(
    { email: clean },
    {
      $setOnInsert: {
        email: clean,
        source,
        reason,
        userAgent,
        ip,
      },
    },
    { upsert: true }
  )
  return { ok: true, email: clean }
}

/**
 * Small HTML confirmation page returned to Gmail's one-click GET.
 * Gmail displays this in an iframe on its side, but many clients open
 * the link in a full tab — so give a nice message either way.
 */
function htmlPage({ email, ok }) {
  const title = ok
    ? 'تم إلغاء الاشتراك بنجاح'
    : 'تعذّر إلغاء الاشتراك — رابط غير صالح'
  const body = ok
    ? `تم إلغاء اشتراك ${email || 'بريدك'} من رسائلنا الترويجية.<br>ستستمر رسائل الحساب الضرورية فقط.`
    : 'الرابط غير صحيح أو منتهي. الرجاء زيارة صفحة إلغاء الاشتراك من موقعنا مباشرة.'
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{margin:0;padding:40px 20px;background:#F8F9FA;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:center;color:#1f2937;}
    .card{max-width:520px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
    h1{color:#1B3A6B;font-size:20px;margin:0 0 12px;}
    p{color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 20px;}
    a{display:inline-block;background:#C9A84C;color:#1B3A6B;padding:10px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;}
    .ok{width:56px;height:56px;border-radius:50%;background:${ok ? '#dcfce7' : '#fee2e2'};color:${ok ? '#16a34a' : '#dc2626'};line-height:56px;margin:0 auto 16px;font-size:28px;}
  </style>
</head>
<body>
  <div class="card">
    <div class="ok">${ok ? '✓' : '⚠︎'}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="/">العودة للرئيسية</a>
  </div>
</body>
</html>`
}

export async function handleUnsubscribeGet(request) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email') || ''
  const token = url.searchParams.get('t') || ''
  const ok = verify(email, token)
  if (ok) {
    await record({ email, source: 'one-click', request })
  }
  return new NextResponse(htmlPage({ email, ok }), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function handleUnsubscribePost(request) {
  const contentType = request.headers.get('content-type') || ''
  let email = ''
  let reason = ''
  let source = 'landing-page'

  // Gmail's List-Unsubscribe-Post=One-Click sends form data — no JSON body.
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    const params = new URLSearchParams(text)
    email = params.get('email') || ''
    // Gmail signals one-click by including this key
    if (params.get('List-Unsubscribe') === 'One-Click') {
      source = 'one-click'
      // For Gmail one-click, we trust the URL that was in List-Unsubscribe.
      // Extract email + token from the referring URL, which Gmail preserves.
      const url = new URL(request.url)
      email = email || url.searchParams.get('email') || ''
      const token = url.searchParams.get('t') || ''
      if (!verify(email, token)) {
        return NextResponse.json(
          { error: 'invalid_token' },
          { status: 400 }
        )
      }
    }
  } else {
    const body = await request.json().catch(() => ({}))
    email = body?.email || ''
    reason = body?.reason || ''
  }

  const res = await record({ email, source, reason, request })
  if (!res.ok) {
    return NextResponse.json({ error: res.error || 'failed' }, { status: 400 })
  }
  return NextResponse.json({ success: true, email: res.email })
}
