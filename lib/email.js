import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
const SENDER_NAME = process.env.SENDER_NAME || 'مجلس رواد الأعمال العماني'
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || null
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

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
async function sendEmail({ to, subject, html }) {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to)
    return { skipped: true }
  }
  try {
    const payload = {
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }
    if (REPLY_TO_EMAIL) {
      payload.replyTo = REPLY_TO_EMAIL
    }
    const { data, error } = await resend.emails.send(payload)
    if (error) {
      console.error('[email] Resend error:', error)
      return { error }
    }
    console.log('[email] Sent to', to, 'id:', data?.id)
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
