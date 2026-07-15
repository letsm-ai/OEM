import { Resend } from 'resend'
import crypto from 'crypto'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
const SENDER_NAME = process.env.SENDER_NAME || 'مجلس رواد الأعمال العماني'
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || null
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const UNSUB_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.RESEND_API_KEY ||
  'majles-unsubscribe-fallback'

/** Same algorithm as /lib/api/unsubscribe.js `signUnsubToken()`. */
function unsubToken(email) {
  const h = crypto.createHmac('sha256', UNSUB_SECRET)
  h.update(String(email || '').toLowerCase().trim())
  return h.digest('hex').slice(0, 12)
}

/** Build a signed one-click unsubscribe URL for a specific recipient. */
function buildUnsubUrl(email) {
  const base = BASE_URL.replace(/\/$/, '')
  const e = encodeURIComponent(String(email || '').toLowerCase().trim())
  const t = unsubToken(email)
  return `${base}/api/unsubscribe?email=${e}&t=${t}`
}

/**
 * Categories:
 *   - 'promotional' : abandoned-cart, newsletter, marketing → respect opt-out
 *   - 'transactional': password reset, order receipts, subscription confirmations,
 *                       appointment confirmations → ALWAYS send (required for account)
 */
const PROMOTIONAL_CATEGORIES = new Set(['promotional', 'marketing', 'abandoned-cart', 'newsletter'])

let resendClient = null
function getResend() {
  if (!RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY)
  return resendClient
}

/**
 * Fire-and-forget send. Never throws; returns {id} on success or {error} on failure.
 * Email failures must NOT break user-facing flows (signup / subscribe / reset).
 */
/**
 * Strip HTML → plain text (Gmail/Outlook penalise HTML-only emails)
 */
function htmlToText(html) {
  if (!html) return ''
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function sendEmail({ to, subject, html, category = 'transactional' }) {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to)
    return { skipped: true }
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((r) => String(r || '').toLowerCase().trim())
    .filter(Boolean)

  // ---- Filter out opted-out addresses for promotional mail ----
  let deliverTo = recipients
  if (PROMOTIONAL_CATEGORIES.has(category)) {
    try {
      // Lazy import so we don't couple email.js to Mongoose at module load
      const { connectDB } = await import('@/lib/db')
      const { EmailOptOut } = await import('@/lib/models')
      await connectDB()
      const optedOut = await EmailOptOut.find({ email: { $in: recipients } })
        .select('email')
        .lean()
      const blocked = new Set(optedOut.map((d) => d.email))
      deliverTo = recipients.filter((r) => !blocked.has(r))
      if (deliverTo.length === 0) {
        console.log('[email] all recipients opted out; skipping', recipients)
        return { skipped: 'opted-out' }
      }
      if (deliverTo.length !== recipients.length) {
        console.log('[email] filtered opted-out recipients:', [...blocked])
      }
    } catch (e) {
      // Never block a send on a DB error — better to send than to silently drop
      console.error('[email] opt-out lookup failed, continuing:', e.message)
    }
  }

  try {
    // Deliverability-friendly one-click unsubscribe (RFC 8058), signed per-recipient.
    // For multi-recipient sends we sign the first (Gmail only uses one anyway).
    const primary = deliverTo[0]
    const unsubUrl = `<${buildUnsubUrl(primary)}>`
    const unsubMailto = REPLY_TO_EMAIL
      ? `<mailto:${REPLY_TO_EMAIL}?subject=unsubscribe>`
      : null

    const payload = {
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: deliverTo,
      subject,
      html,
      // Multipart/alternative — Gmail/Outlook heavily penalise HTML-only emails.
      text: htmlToText(html),
      headers: {
        'List-Unsubscribe': unsubMailto ? `${unsubMailto}, ${unsubUrl}` : unsubUrl,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `majles-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    }
    if (REPLY_TO_EMAIL) {
      payload.replyTo = REPLY_TO_EMAIL
    }
    const { data, error } = await resend.emails.send(payload)
    if (error) {
      console.error('[email] Resend error:', error)
      return { error }
    }
    console.log('[email] Sent to', deliverTo, 'id:', data?.id)
    return { id: data?.id }
  } catch (err) {
    console.error('[email] Exception:', err)
    return { error: err.message }
  }
}

/* ----------- SHARED TEMPLATE SHELL ----------- */
function baseTemplate({ preheader = '', title = '', body = '' }) {
  // Cairo web font via Google fonts; safe fallback for clients that block it.
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#1f2937;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F9FA;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1B3A6B 0%,#152c52 100%);padding:32px 28px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background:#C9A84C;border-radius:12px;line-height:56px;text-align:center;color:#1B3A6B;font-size:26px;font-weight:800;margin-bottom:12px;">م</div>
          <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">مجلس رواد الأعمال العماني</div>
          <div style="color:#C9A84C;font-size:12px;margin-top:4px;">منظومة رواد الأعمال العمانيين</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 28px;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 28px;background:#F8F9FA;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
          © ${new Date().getFullYear()} مجلس رواد الأعمال العماني — جميع الحقوق محفوظة<br>
          <a href="${BASE_URL}" style="color:#1B3A6B;text-decoration:none;">${BASE_URL.replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function primaryButton(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="border-radius:10px;background:#1B3A6B;">
    <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:'Cairo',sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`
}

/* ----------- 1) WELCOME EMAIL ----------- */
export async function sendWelcomeEmail({ to, name }) {
  const safeName = (name || 'صديقنا').toString()
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1B3A6B;">أهلاً وسهلاً بك يا ${safeName} 👋</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:#374151;">
      يسعدنا انضمامك إلى <strong style="color:#1B3A6B;">مجلس رواد الأعمال العماني</strong> —
      منصة تجمع رواد الأعمال في سلطنة عُمان في مكان واحد.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;">ما يمكنك عمله الآن:</p>
    <ul style="margin:0 0 20px;padding-right:20px;color:#374151;font-size:14px;line-height:1.9;">
      <li>تصفح دليل الشركات العمانية</li>
      <li>الاطلاع على باقات العضوية ومزاياها</li>
      <li>تحديث ملفك الشخصي من لوحة التحكم</li>
    </ul>
    ${primaryButton('الدخول للوحة التحكم', `${BASE_URL}/dashboard`)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.8;">
      إذا واجهت أي مشكلة أو لديك سؤال، ففريقنا جاهز لمساعدتك.
    </p>
  `
  return sendEmail({
    to,
    subject: `أهلاً بك في مجلس رواد الأعمال العماني`,
    html: baseTemplate({
      preheader: 'يسعدنا انضمامك إلينا — ابدأ الآن',
      title: 'مرحباً',
      body,
    }),
  })
}

/* ----------- 2) SUBSCRIPTION CONFIRMATION ----------- */
export async function sendSubscriptionEmail({ to, name, tierAr, amount, expiryFormatted }) {
  const safeName = (name || 'صديقنا').toString()
  const body = `
    <div style="text-align:center;margin:4px 0 18px;">
      <div style="display:inline-block;width:56px;height:56px;background:#C9A84C20;border:2px solid #C9A84C;border-radius:50%;line-height:54px;color:#8a6f2d;font-size:26px;font-weight:800;">✓</div>
    </div>
    <h2 style="margin:0 0 10px;font-size:22px;color:#1B3A6B;text-align:center;">تم تفعيل عضويتك بنجاح</h2>
    <p style="margin:0 0 18px;text-align:center;color:#374151;font-size:15px;">مرحباً ${safeName}، شكراً لانضمامك لباقتنا المميّزة.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#6b7280;">باقة العضوية</div>
          <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${tierAr}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:12px;color:#6b7280;">المبلغ المدفوع</div>
          <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${amount} ر.ع سنوياً</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-size:12px;color:#6b7280;">تاريخ انتهاء الاشتراك</div>
          <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${expiryFormatted}</div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:#374151;font-size:14px;">يمكنك الآن الاستفادة من جميع مزايا باقتك، بما في ذلك خصومات الأعضاء والمزايا الحصرية.</p>
    ${primaryButton('عرض عضويتي', `${BASE_URL}/dashboard`)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">هذه رسالة تأكيد آلية. إذا لم تقم بالاشتراك، نرجو التواصل معنا فوراً.</p>
  `
  return sendEmail({
    to,
    subject: `تم تفعيل عضوية ${tierAr} — مجلس رواد الأعمال`,
    html: baseTemplate({
      preheader: `تم تفعيل باقة ${tierAr} حتى ${expiryFormatted}`,
      title: 'تأكيد الاشتراك',
      body,
    }),
  })
}

/* ----------- 4) APPOINTMENT CONFIRMATION ----------- */
export async function sendAppointmentConfirmationEmail({
  to,
  name,
  expertName,
  dateFormatted,
  startTime,
  endTime,
  amount,
}) {
  const safeName = (name || 'صديقنا').toString()
  const body = `
    <div style="text-align:center;margin:4px 0 18px;">
      <div style="display:inline-block;width:56px;height:56px;background:#C9A84C20;border:2px solid #C9A84C;border-radius:50%;line-height:54px;color:#8a6f2d;font-size:26px;font-weight:800;">✓</div>
    </div>
    <h2 style="margin:0 0 10px;font-size:22px;color:#1B3A6B;text-align:center;">تم تأكيد حجز الجلسة</h2>
    <p style="margin:0 0 18px;text-align:center;color:#374151;font-size:15px;">مرحباً ${safeName}، شكراً لحجزك جلسة استشارية مع <strong>${expertName}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">الخبير</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${expertName}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">التاريخ</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${dateFormatted}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">الوقت</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;" dir="ltr">${startTime} - ${endTime}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <div style="font-size:12px;color:#6b7280;">المبلغ المدفوع</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${amount} ر.ع</div>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;color:#374151;font-size:14px;">يمكنك إلغاء الحجز من صفحة "حجوزاتي" قبل الجلسة بأكثر من 24 ساعة.</p>
    ${primaryButton('عرض حجوزاتي', `${BASE_URL}/consultations/my-bookings`)}
  `
  return sendEmail({
    to,
    subject: `تأكيد حجز استشارة — ${dateFormatted} ${startTime}`,
    html: baseTemplate({
      preheader: `جلسة مع ${expertName} — ${dateFormatted}`,
      title: 'تأكيد الحجز',
      body,
    }),
  })
}

/* ----------- 5) NEW BOOKING NOTIFICATION (to expert) ----------- */
export async function sendNewBookingNotifyExpert({
  to,
  expertName,
  clientName,
  dateFormatted,
  startTime,
  endTime,
  amount,
}) {
  const safeExpert = (expertName || '').toString()
  const safeClient = (clientName || 'عميل').toString()
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1B3A6B;">حجز جديد وصلك 🎉</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">مرحباً ${safeExpert}، لديك حجز جديد من <strong>${safeClient}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:12px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">العميل</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#1B3A6B;">${safeClient}</div>
      </td></tr>
      <tr><td style="padding:12px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">التاريخ والوقت</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#1B3A6B;">${dateFormatted} — <span dir="ltr">${startTime} - ${endTime}</span></div>
      </td></tr>
      <tr><td style="padding:12px 18px;">
        <div style="font-size:12px;color:#6b7280;">المبلغ</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#1B3A6B;">${amount} ر.ع</div>
      </td></tr>
    </table>
    ${primaryButton('فتح لوحة الخبير', `${BASE_URL}/expert`)}
  `
  return sendEmail({
    to,
    subject: `حجز جديد: ${safeClient} — ${dateFormatted}`,
    html: baseTemplate({
      preheader: `حجز جديد ${dateFormatted} ${startTime}`,
      title: 'حجز جديد',
      body,
    }),
  })
}

/* ----------- 7) APPOINTMENT REMINDER (24h before) ----------- */
export async function sendAppointmentReminderEmail({
  to,
  name,
  expertName,
  dateFormatted,
  startTime,
  endTime,
}) {
  const safeName = (name || 'صديقنا').toString()
  const body = `
    <div style="text-align:center;margin:4px 0 18px;">
      <div style="display:inline-block;width:56px;height:56px;background:#C9A84C20;border:2px solid #C9A84C;border-radius:50%;line-height:54px;color:#8a6f2d;font-size:26px;font-weight:800;">⏰</div>
    </div>
    <h2 style="margin:0 0 10px;font-size:22px;color:#1B3A6B;text-align:center;">تذكير بجلستك غداً</h2>
    <p style="margin:0 0 18px;text-align:center;color:#374151;font-size:15px;">
      مرحباً ${safeName}، هذا تذكير بأن لديك جلسة استشارية <strong>غداً</strong> مع <strong>${expertName}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;">التاريخ</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;">${dateFormatted}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <div style="font-size:12px;color:#6b7280;">الوقت</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1B3A6B;" dir="ltr">${startTime} - ${endTime}</div>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;color:#374151;font-size:14px;">نذكّرك بأنه لا يمكنك إلغاء الحجز في آخر 24 ساعة. استعد جيداً وكن حاضراً في الموعد.</p>
    ${primaryButton('عرض تفاصيل الحجز', `${BASE_URL}/consultations/my-bookings`)}
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">
      إن احتجت التواصل مع الخبير قبل الجلسة، يمكنك الرد على هذا البريد وسيُرسل إلى فريق الدعم.
    </p>
  `
  return sendEmail({
    to,
    subject: `⏰ تذكير: جلسة استشارية غداً ${startTime} مع ${expertName}`,
    html: baseTemplate({
      preheader: `جلسة استشارية غداً في ${startTime}`,
      title: 'تذكير الجلسة',
      body,
    }),
  })
}

/* ----------- 6) APPOINTMENT CANCELLATION ----------- */
export async function sendAppointmentCancellationEmail({
  to,
  name,
  expertName,
  dateFormatted,
  startTime,
  cancelledBy,
}) {
  const who =
    cancelledBy === 'expert' ? 'الخبير' : cancelledBy === 'admin' ? 'الإدارة' : 'العميل'
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1B3A6B;">تم إلغاء الجلسة</h2>
    <p style="margin:0 0 12px;color:#374151;font-size:15px;">مرحباً ${name || 'صديقنا'}،</p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">نبلغك أن جلستك مع <strong>${expertName}</strong> يوم <strong>${dateFormatted}</strong> الساعة <strong dir="ltr">${startTime}</strong> تم إلغاؤها بواسطة ${who}.</p>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">يمكنك حجز موعد جديد في أي وقت.</p>
    ${primaryButton('حجز جلسة جديدة', `${BASE_URL}/consultations`)}
  `
  return sendEmail({
    to,
    subject: `تم إلغاء جلسة الاستشارة — ${dateFormatted}`,
    html: baseTemplate({
      preheader: 'تم إلغاء جلسة الاستشارة',
      title: 'إلغاء الجلسة',
      body,
    }),
  })
}

/* ----------- ADMIN BROADCAST / NEWSLETTER ----------- */
/**
 * Build the branded HTML for a single broadcast recipient (with their own unsub link).
 * Used by both individual send and the batch send.
 */
function buildBroadcastHtml({ to, name, subject, htmlBody }) {
  const safeName = (name || '').toString().trim()
  const greeting = safeName
    ? `<p style="margin:0 0 14px;color:#374151;font-size:15px;">مرحباً <strong>${escapeHtml(safeName)}</strong>،</p>`
    : ''
  const unsubUrl = buildUnsubUrl(to)
  const body = `
    ${greeting}
    <div style="font-size:15px;color:#374151;line-height:1.9;">${htmlBody}</div>
    <div style="margin:26px 0 0;padding:14px 16px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:8px;text-align:center;color:#6b7280;font-size:12px;">
      وصلك هذا البريد لأنك عضو في مجلس رواد الأعمال العماني.<br>
      لا تريد استلام هذا النوع من الرسائل مستقبلاً؟
      <a href="${unsubUrl}" style="color:#1B3A6B;text-decoration:underline;font-weight:600;">إلغاء الاشتراك بضغطة واحدة</a>
    </div>
  `
  return baseTemplate({
    preheader: htmlToText(htmlBody).slice(0, 120),
    title: subject,
    body,
  })
}

/**
 * Send a broadcast/newsletter email to a single recipient.
 * Wraps the caller's raw HTML in the branded template + shows unsubscribe hint.
 * Uses category='newsletter' so opt-outs are respected automatically.
 */
export async function sendBroadcastEmail({ to, name, subject, htmlBody }) {
  const html = buildBroadcastHtml({ to, name, subject, htmlBody })
  return sendEmail({
    to,
    subject,
    category: 'newsletter',
    html,
  })
}

/**
 * Filter recipients to remove opted-out addresses.
 * Returns { deliverable: [{email, name}], blocked: Set<email> }
 */
async function filterOptedOut(recipients) {
  const emails = recipients.map((r) => r.email)
  try {
    const { connectDB } = await import('@/lib/db')
    const { EmailOptOut } = await import('@/lib/models')
    await connectDB()
    const optedOut = await EmailOptOut.find({ email: { $in: emails } })
      .select('email')
      .lean()
    const blocked = new Set(optedOut.map((d) => d.email))
    return {
      deliverable: recipients.filter((r) => !blocked.has(r.email)),
      blocked,
    }
  } catch (e) {
    console.error('[email] opt-out lookup failed, continuing:', e.message)
    return { deliverable: recipients, blocked: new Set() }
  }
}

/**
 * Send a broadcast to MANY recipients using Resend's Batch API.
 * - Bypasses per-second rate limits entirely (single HTTP request per batch of 100)
 * - Automatically filters opted-out addresses
 * - Chunks into batches of `BATCH_SIZE` (default 100 — Resend's max)
 *
 * @param {Array<{email:string, name?:string}>} recipients
 * @param {{subject:string, htmlBody:string}} opts
 * @returns {Promise<{sent:number, failed:number, skipped:number, errors:string[], perRecipient:Array<{email,status,error?}>}>}
 */
export async function sendBroadcastBatch(recipients, { subject, htmlBody }) {
  const resend = getResend()
  const stats = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    perRecipient: [],
  }

  if (!resend) {
    console.warn('[broadcast] RESEND_API_KEY not set; skipping batch send')
    for (const r of recipients) {
      stats.skipped++
      stats.perRecipient.push({ email: r.email, status: 'SKIPPED', error: 'RESEND_API_KEY missing' })
    }
    return stats
  }

  // ---- Normalize + dedupe ----
  const normalized = []
  const seen = new Set()
  for (const r of recipients) {
    const email = String(r?.email || '').toLowerCase().trim()
    if (!email || seen.has(email)) continue
    seen.add(email)
    normalized.push({ email, name: (r?.name || '').toString() })
  }

  if (normalized.length === 0) return stats

  // ---- Filter opted-out (broadcast is 'newsletter' category) ----
  const { deliverable, blocked } = await filterOptedOut(normalized)
  for (const e of blocked) {
    stats.skipped++
    stats.perRecipient.push({ email: e, status: 'OPTED_OUT' })
  }

  if (deliverable.length === 0) return stats

  const BATCH_SIZE = 100 // Resend Batch API hard limit
  const chunks = []
  for (let i = 0; i < deliverable.length; i += BATCH_SIZE) {
    chunks.push(deliverable.slice(i, i + BATCH_SIZE))
  }

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx]
    // Build one payload object per recipient (personalized unsub token)
    const payloads = chunk.map((r) => {
      const unsubUrl = `<${buildUnsubUrl(r.email)}>`
      const unsubMailto = REPLY_TO_EMAIL
        ? `<mailto:${REPLY_TO_EMAIL}?subject=unsubscribe>`
        : null
      const html = buildBroadcastHtml({
        to: r.email,
        name: r.name,
        subject,
        htmlBody,
      })
      const payload = {
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to: [r.email],
        subject,
        html,
        text: htmlToText(html),
        headers: {
          'List-Unsubscribe': unsubMailto ? `${unsubMailto}, ${unsubUrl}` : unsubUrl,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': `majles-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      }
      if (REPLY_TO_EMAIL) payload.replyTo = REPLY_TO_EMAIL
      return payload
    })

    try {
      const { data, error } = await resend.batch.send(payloads)
      if (error) {
        // Whole batch rejected — mark each recipient failed with the shared reason
        const msg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error))
        console.error('[broadcast] batch send rejected:', msg)
        for (const p of payloads) {
          stats.failed++
          stats.perRecipient.push({ email: p.to[0], status: 'FAILED', error: msg.slice(0, 300) })
        }
        if (stats.errors.length < 5) stats.errors.push(`batch#${cIdx + 1}: ${msg.slice(0, 300)}`)
      } else {
        // data.data is an array of { id } — one per email in the same order
        const results = Array.isArray(data?.data) ? data.data : []
        for (let i = 0; i < payloads.length; i++) {
          const email = payloads[i].to[0]
          const r = results[i]
          if (r && r.id) {
            stats.sent++
            stats.perRecipient.push({ email, status: 'SENT' })
          } else {
            stats.failed++
            stats.perRecipient.push({ email, status: 'FAILED', error: 'no id returned' })
          }
        }
        console.log(`[broadcast] batch #${cIdx + 1}/${chunks.length}: sent ${results.length}/${payloads.length}`)
      }
    } catch (err) {
      const msg = err?.message || String(err)
      console.error('[broadcast] batch exception:', msg)
      for (const p of payloads) {
        stats.failed++
        stats.perRecipient.push({ email: p.to[0], status: 'FAILED', error: msg.slice(0, 300) })
      }
      if (stats.errors.length < 5) stats.errors.push(`batch#${cIdx + 1}: ${msg.slice(0, 300)}`)
    }

    // Small pause between batches to be nice to Resend (only if we have more chunks)
    if (cIdx < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return stats
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = (name || 'صديقنا').toString()
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:#1B3A6B;">طلب إعادة تعيين كلمة المرور</h2>
    <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.9;">مرحباً ${safeName}،</p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.9;">
      تلقينا طلباً بإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لاختيار كلمة مرور جديدة:
    </p>
    ${primaryButton('إعادة تعيين كلمة المرور', resetUrl)}
    <p style="margin:14px 0 8px;color:#6b7280;font-size:13px;">أو انسخ الرابط التالي إلى متصفحك:</p>
    <div style="word-break:break-all;direction:ltr;text-align:left;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:12px;color:#1B3A6B;font-family:monospace;">${resetUrl}</div>
    <div style="margin:18px 0 0;padding:12px 14px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;color:#92400E;font-size:13px;">
      ⚠️ هذا الرابط صالح لمدة <strong>ساعة واحدة فقط</strong> ويستخدم مرة واحدة.
    </div>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.8;">
      إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة. حسابك آمن.
    </p>
  `
  return sendEmail({
    to,
    subject: `إعادة تعيين كلمة المرور — مجلس رواد الأعمال العماني`,
    html: baseTemplate({
      preheader: 'طلب إعادة تعيين كلمة المرور — صالح لساعة فقط',
      title: 'إعادة تعيين كلمة المرور',
      body,
    }),
  })
}

/* ----------- SHARED HELPERS FOR ORDER EMAILS ----------- */
const fmtOMR = (n) => {
  const v = Number(n || 0)
  return v.toFixed(2)
}
const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function orderItemsTable(items) {
  if (!items || items.length === 0) return ''
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#374151;font-size:14px;">
          ${escapeHtml(it.nameAr)}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;text-align:center;width:60px;">
          ×${it.quantity}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#1B3A6B;font-size:14px;font-weight:700;text-align:left;width:100px;">
          ${fmtOMR(it.lineSubtotal)} ر.ع
        </td>
      </tr>`
    )
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin:8px 0 16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;overflow:hidden;">
      <thead>
        <tr>
          <th align="right" style="padding:10px 12px;background:#F8F9FA;color:#6b7280;font-size:12px;font-weight:600;">المنتج</th>
          <th align="center" style="padding:10px 12px;background:#F8F9FA;color:#6b7280;font-size:12px;font-weight:600;">الكمية</th>
          <th align="left" style="padding:10px 12px;background:#F8F9FA;color:#6b7280;font-size:12px;font-weight:600;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

function addressBox(addr) {
  if (!addr || !addr.name) return ''
  return `
    <div style="margin:8px 0 16px;padding:12px 14px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:10px;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">عنوان الشحن</div>
      <div style="font-size:14px;color:#1B3A6B;font-weight:700;">${escapeHtml(addr.name)}</div>
      <div style="font-size:13px;color:#374151;direction:ltr;text-align:right;">${escapeHtml(addr.phone)}</div>
      <div style="font-size:13px;color:#374151;margin-top:4px;line-height:1.7;">
        ${escapeHtml(addr.addressLine)}${addr.city ? '، ' + escapeHtml(addr.city) : ''}${addr.governorate ? '، ' + escapeHtml(addr.governorate) : ''}
      </div>
      ${addr.notes ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;"><strong>ملاحظات:</strong> ${escapeHtml(addr.notes)}</div>` : ''}
    </div>`
}

/* ----------- ORDER CONFIRMATION (buyer) ----------- */
export async function sendOrderConfirmationEmail({ to, name, order, isGuest = false }) {
  const safeName = (name || 'صديقنا').toString()
  const orderId = String(order?.id || order?._id || '').slice(0, 8)
  // Invitation for guests to convert to a full account so they can track future orders
  const guestSignupCta = isGuest
    ? `
    <div style="margin:16px 0 6px;padding:14px;background:linear-gradient(135deg,#C9A84C15,#1B3A6B08);border:2px dashed #C9A84C;border-radius:10px;text-align:center;">
      <div style="font-size:22px;line-height:1;margin-bottom:6px;">👤</div>
      <div style="font-size:14px;font-weight:700;color:#1B3A6B;">أنشئ حسابك لحفظ طلباتك</div>
      <div style="margin:6px 0 10px;color:#6b7280;font-size:12px;line-height:1.7;">
        اشتريت كضيف — يمكنك إنشاء حساب مجاناً بنفس بريدك <span style="direction:ltr;font-family:monospace;">${escapeHtml(to)}</span>
        لمتابعة طلباتك وحفظ عناوينك للمرات القادمة.
      </div>
      <a href="${BASE_URL}/signup?email=${encodeURIComponent(to)}" style="display:inline-block;padding:10px 22px;background:#1B3A6B;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">
        إنشاء حساب مجاناً
      </a>
    </div>`
    : ''
  const body = `
    <div style="text-align:center;margin:4px 0 18px;">
      <div style="display:inline-block;width:56px;height:56px;background:#ECFDF5;border:2px solid #10B981;border-radius:50%;line-height:54px;color:#047857;font-size:26px;font-weight:800;">✓</div>
    </div>
    <h2 style="margin:0 0 10px;font-size:22px;color:#1B3A6B;text-align:center;">تم تأكيد طلبك بنجاح</h2>
    <p style="margin:0 0 14px;text-align:center;color:#374151;font-size:15px;">
      شكراً ${escapeHtml(safeName)}، تم استلام طلبك وسيتم التواصل معك من البائع لتنسيق الشحن.
    </p>

    <div style="margin:8px 0 14px;padding:12px 14px;background:#1B3A6B;border-radius:10px;color:#fff;">
      <div style="font-size:12px;opacity:0.8;">رقم الطلب</div>
      <div style="font-family:monospace;font-size:16px;font-weight:700;margin-top:2px;direction:ltr;text-align:right;">#${escapeHtml(orderId).toUpperCase()}</div>
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px;color:#1B3A6B;">محتويات الطلب</h3>
    ${orderItemsTable(order?.items || [])}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">
      <tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px;">المجموع الفرعي</td>
        <td style="padding:4px 0;color:#374151;font-size:13px;text-align:left;">${fmtOMR(order?.subtotal)} ر.ع</td>
      </tr>
      ${
        (order?.discountAmount || 0) > 0
          ? `<tr>
              <td style="padding:4px 0;color:#059669;font-size:13px;">خصم العضوية (${order.discountPercent}%)</td>
              <td style="padding:4px 0;color:#059669;font-size:13px;text-align:left;">− ${fmtOMR(order.discountAmount)} ر.ع</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding:8px 0 4px;border-top:2px solid #1B3A6B;color:#1B3A6B;font-size:15px;font-weight:700;">الإجمالي المدفوع</td>
        <td style="padding:8px 0 4px;border-top:2px solid #1B3A6B;color:#1B3A6B;font-size:15px;font-weight:800;text-align:left;">${fmtOMR(order?.totalPaid)} ر.ع</td>
      </tr>
    </table>

    ${addressBox(order?.shippingAddress)}

    ${primaryButton('عرض طلباتي', `${BASE_URL}/dashboard`)}
    ${guestSignupCta}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.8;">
      إن كان لديك أي استفسار بخصوص الطلب، يمكنك التواصل معنا عبر الرد على هذه الرسالة.
    </p>
  `
  return sendEmail({
    to,
    subject: `تأكيد طلبك #${orderId.toUpperCase()} — مجلس رواد الأعمال العماني`,
    html: baseTemplate({
      preheader: `تم تأكيد طلبك بإجمالي ${fmtOMR(order?.totalPaid)} ر.ع`,
      title: 'تأكيد الطلب',
      body,
    }),
  })
}

/* ----------- NEW ORDER NOTIFICATION (vendor) ----------- */
export async function sendVendorNewOrderEmail({
  to,
  vendorName,
  order,
  items,
  buyerName,
  buyerEmail,
  vendorSubtotal,
  vendorCommission,
  vendorNet,
}) {
  const safeVendor = (vendorName || 'البائع').toString()
  const orderId = String(order?.id || order?._id || '').slice(0, 8)
  const body = `
    <div style="text-align:center;margin:4px 0 14px;">
      <div style="display:inline-block;padding:6px 14px;background:#C9A84C;border-radius:999px;color:#1B3A6B;font-size:12px;font-weight:800;">
        🛒 طلب جديد
      </div>
    </div>
    <h2 style="margin:0 0 8px;font-size:22px;color:#1B3A6B;text-align:center;">لديك طلب جديد!</h2>
    <p style="margin:0 0 14px;text-align:center;color:#374151;font-size:15px;">
      مرحباً ${escapeHtml(safeVendor)}، تلقيت للتو طلباً جديداً من أحد العملاء.
    </p>

    <div style="margin:8px 0 14px;padding:12px 14px;background:#1B3A6B;border-radius:10px;color:#fff;">
      <div style="font-size:12px;opacity:0.8;">رقم الطلب</div>
      <div style="font-family:monospace;font-size:16px;font-weight:700;margin-top:2px;direction:ltr;text-align:right;">#${escapeHtml(orderId).toUpperCase()}</div>
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px;color:#1B3A6B;">منتجاتك في هذا الطلب</h3>
    ${orderItemsTable(items || [])}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">
      <tr>
        <td style="padding:4px 0;color:#374151;font-size:13px;">إجمالي منتجاتك</td>
        <td style="padding:4px 0;color:#1B3A6B;font-size:13px;font-weight:700;text-align:left;">${fmtOMR(vendorSubtotal)} ر.ع</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#DC2626;font-size:13px;">عمولة المنصّة (5%)</td>
        <td style="padding:4px 0;color:#DC2626;font-size:13px;text-align:left;">− ${fmtOMR(vendorCommission)} ر.ع</td>
      </tr>
      <tr>
        <td style="padding:8px 0 4px;border-top:2px solid #10B981;color:#065F46;font-size:15px;font-weight:700;">صافي أرباحك</td>
        <td style="padding:8px 0 4px;border-top:2px solid #10B981;color:#065F46;font-size:15px;font-weight:800;text-align:left;">${fmtOMR(vendorNet)} ر.ع</td>
      </tr>
    </table>

    <div style="margin:8px 0 16px;padding:12px 14px;background:#F8F9FA;border:1px solid #e5e7eb;border-radius:10px;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">بيانات المشتري</div>
      <div style="font-size:14px;color:#1B3A6B;font-weight:700;">${escapeHtml(buyerName || '')}</div>
      <div style="font-size:13px;color:#374151;direction:ltr;text-align:right;">${escapeHtml(buyerEmail || '')}</div>
    </div>

    ${addressBox(order?.shippingAddress)}

    ${primaryButton('إدارة الطلب', `${BASE_URL}/dashboard/vendor`)}

    <div style="margin:18px 0 0;padding:12px 14px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;color:#92400E;font-size:13px;">
      ⚡ يُرجى تجهيز الطلب وشحنه في أقرب وقت ممكن، ثم تحديث حالة الطلب إلى "تم الشحن" من لوحة البائع.
    </div>
  `
  return sendEmail({
    to,
    subject: `طلب جديد #${orderId.toUpperCase()} — مجلس رواد الأعمال العماني`,
    html: baseTemplate({
      preheader: `طلب جديد بقيمة ${fmtOMR(vendorSubtotal)} ر.ع (صافي ${fmtOMR(vendorNet)} ر.ع)`,
      title: 'طلب جديد',
      body,
    }),
  })
}

/**
 * Notify buyer when order status changes (SHIPPED / DELIVERED).
 */
export async function sendOrderStatusUpdateEmail({
  to,
  name,
  order,
  newStatus,
  trackingNumber = '',
  carrier = '',
  note = '',
}) {
  if (!to) return { skipped: true }
  const statusAr = {
    PAID: 'تم الدفع',
    SHIPPED: 'تم الشحن 🚚',
    DELIVERED: 'تم التسليم ✅',
    CANCELLED: 'تم الإلغاء',
  }
  const subject = `${statusAr[newStatus] || newStatus} — طلبك #${String(order.id).slice(0, 8)}`
  const trackLine = trackingNumber
    ? `<p style="margin:8px 0;font-size:14px;"><b>رقم التتبّع:</b> <code style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${trackingNumber}</code>${carrier ? ` — <b>${carrier}</b>` : ''}</p>`
    : ''
  const noteLine = note
    ? `<p style="margin:8px 0;padding:10px;background:#fef3c7;border-right:3px solid #C9A84C;border-radius:6px;font-size:13px;color:#78350F;">${note}</p>`
    : ''
  const body = `
    <p style="font-size:16px;">مرحباً ${name || 'عميلنا الكريم'},</p>
    <p style="font-size:14px;line-height:1.8;">
      لديك تحديث لحالة طلبك رقم
      <code style="font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${String(order.id).slice(0, 8)}</code>:
    </p>
    <div style="margin:16px 0;padding:14px;background:#dbeafe;border-radius:8px;text-align:center;">
      <div style="font-size:18px;font-weight:800;color:#1B3A6B;">${statusAr[newStatus] || newStatus}</div>
    </div>
    ${trackLine}
    ${noteLine}
    <p style="font-size:13px;color:#6b7280;margin-top:16px;">
      شكراً لتسوقك من مجلس رواد الأعمال العماني 🇴🇲
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${BASE_URL}/store/orders" style="display:inline-block;padding:10px 24px;background:#C9A84C;color:#1B3A6B;text-decoration:none;border-radius:8px;font-weight:700;">
        عرض طلباتي
      </a>
    </div>
  `
  return sendEmail({
    to,
    subject,
    html: baseTemplate({
      title: statusAr[newStatus] || 'تحديث الطلب',
      body,
    }),
  })
}

/**
 * Abandoned cart reminder email.
 */
export async function sendAbandonedCartEmail({ to, name, items = [] }) {
  if (!to || items.length === 0) return { skipped: true }
  const subject = `👋 ${name || 'عزيزنا'}، لقد تركت بعض المنتجات في سلّتك!`
  const itemsHtml = items.slice(0, 5).map((it) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:13px;font-weight:600;color:#1B3A6B;">${it.nameAr || 'منتج'}</div>
        <div style="font-size:11px;color:#6b7280;">${it.quantity}× ${(Number(it.unitPrice||0)).toFixed(3)} ر.ع</div>
      </td>
    </tr>
  `).join('')
  const total = items.reduce((s, it) => s + (Number(it.unitPrice||0) * Number(it.quantity||1)), 0)
  const body = `
    <p style="font-size:16px;">مرحباً ${name || 'عزيزنا العميل'} 👋</p>
    <p style="font-size:14px;line-height:1.8;">
      لاحظنا أنك تركت بعض المنتجات الرائعة في سلّتك دون إتمام الشراء.
      نحن نحتفظ لك بها جاهزة — لكنها قد تنفد قريباً!
    </p>
    <div style="margin:16px 0;padding:12px;background:#fafafa;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#1B3A6B;margin-bottom:8px;">منتجاتك المحفوظة:</div>
      <table style="width:100%;border-collapse:collapse;">${itemsHtml}</table>
      <div style="margin-top:8px;padding-top:8px;border-top:2px solid #1B3A6B;text-align:left;">
        <b>المجموع التقريبي:</b> ${total.toFixed(3)} ر.ع
      </div>
    </div>
    <div style="text-align:center;margin:20px 0;">
      <a href="${BASE_URL}/store/cart" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#1B3A6B;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
        🛒 متابعة الشراء الآن
      </a>
    </div>
    <p style="font-size:12px;color:#6b7280;text-align:center;">
      إن لم تكن مهتماً، تجاهل هذه الرسالة بكل بساطة.
    </p>
  `
  return sendEmail({
    to,
    subject,
    category: 'promotional',
    html: baseTemplate({
      title: 'لا تفوّت فرصتك!',
      body,
    }),
  })
}
