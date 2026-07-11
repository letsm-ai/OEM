/**
 * Predefined broadcast email templates for common admin campaigns.
 * Each template ships in Arabic (primary market) with an English variant.
 *
 * Runtime substitution: the sendBroadcastEmail() helper automatically prepends a
 * personalised greeting ("مرحباً {name}،") — templates below should NOT hardcode
 * "مرحباً" so we avoid duplication. Placeholders in [square brackets] are
 * intended as edit hints for the admin (they render as-is if left un-edited).
 */

export const BROADCAST_TEMPLATE_CATEGORIES = [
  { key: 'update', label: 'تحديث', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'offer', label: 'عرض', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'reminder', label: 'تذكير', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'welcome', label: 'ترحيب', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'event', label: 'فعالية', color: 'bg-rose-100 text-rose-700 border-rose-200' },
]

export const BROADCAST_TEMPLATES = [
  {
    id: 'feature-update',
    category: 'update',
    icon: 'Sparkles',
    name: 'إطلاق ميزة جديدة',
    description: 'إعلان عن ميزة أو تحديث جديد في المنصّة',
    subject: 'تحديث جديد في مجلس رواد الأعمال العماني 🚀',
    htmlBody: `<p style="font-size:15px;line-height:1.9">يسرّنا أن نُطلعك على تحديث مهمّ في المنصّة يهدف إلى تحسين تجربتك.</p>

<h3 style="color:#1B3A6B;margin:20px 0 10px;font-size:17px">✨ ما الجديد؟</h3>
<ul style="padding-inline-start:20px;font-size:15px;line-height:1.9">
  <li>[أضف الميزة الأولى هنا]</li>
  <li>[أضف الميزة الثانية هنا]</li>
  <li>[أضف الميزة الثالثة هنا]</li>
</ul>

<p style="font-size:15px;line-height:1.9;margin-top:16px">
  ندعوك لتجربتها والاستفادة منها الآن.
</p>

<p style="text-align:center;margin:28px 0">
  <a href="[رابط الميزة]" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">اكتشف الآن</a>
</p>

<p style="font-size:14px;color:#6b7280;margin-top:20px">
  نسعد بملاحظاتك ومقترحاتك دائماً.<br>
  فريق مجلس رواد الأعمال العماني
</p>`,
  },
  {
    id: 'special-offer',
    category: 'offer',
    icon: 'Tag',
    name: 'عرض خاص محدود',
    description: 'إعلان عرض/خصم بمدة زمنية محدودة',
    subject: '🎁 عرض خاص لك — لفترة محدودة',
    htmlBody: `<p style="font-size:15px;line-height:1.9">
  خصصنا لك عرضاً حصرياً لن يتكرر — استفد منه قبل انتهاء الوقت!
</p>

<div style="background:linear-gradient(135deg,#C9A84C22,#C9A84C11);border:2px dashed #C9A84C;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
  <div style="font-size:14px;color:#8a6f2d;font-weight:600;margin-bottom:8px">قيمة العرض</div>
  <div style="font-size:32px;font-weight:900;color:#1B3A6B;line-height:1">[XX%] خصم</div>
  <div style="margin-top:8px;font-size:13px;color:#6b7280">أو استخدم كود: <strong style="color:#1B3A6B">[CODE2025]</strong></div>
</div>

<p style="font-size:15px;line-height:1.9">
  <strong>ما الذي يشمله العرض؟</strong><br>
  [اكتب تفاصيل ما يشمله العرض هنا]
</p>

<p style="font-size:15px;line-height:1.9">
  <strong>⏰ ينتهي العرض في:</strong> [التاريخ]
</p>

<p style="text-align:center;margin:28px 0">
  <a href="[رابط العرض]" style="display:inline-block;background:#C9A84C;color:#1B3A6B;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">استفد الآن</a>
</p>

<p style="font-size:14px;color:#6b7280">
  فريق مجلس رواد الأعمال العماني
</p>`,
  },
  {
    id: 'membership-renewal',
    category: 'reminder',
    icon: 'Clock',
    name: 'تذكير بتجديد العضوية',
    description: 'تذكير أعضاء الباقات المدفوعة بتجديد اشتراكهم',
    subject: 'تذكير: عضويتك تقترب من الانتهاء ⏳',
    htmlBody: `<p style="font-size:15px;line-height:1.9">
  نحيطك علماً بأنّ عضويتك في مجلس رواد الأعمال العماني على وشك الانتهاء.
</p>

<div style="background:#F8F9FA;border-inline-start:4px solid #1B3A6B;padding:16px;margin:20px 0;border-radius:6px">
  <p style="margin:0;font-size:14px;color:#374151;line-height:1.8">
    <strong>الباقة الحالية:</strong> [الباقة]<br>
    <strong>تنتهي في:</strong> [التاريخ]
  </p>
</div>

<h3 style="color:#1B3A6B;margin:20px 0 10px;font-size:16px">لماذا تجدّد الآن؟</h3>
<ul style="padding-inline-start:20px;font-size:15px;line-height:1.9">
  <li>الاستمرار في الحصول على الخصومات والمزايا الحصرية</li>
  <li>الحفاظ على ظهورك في دليل الأعمال</li>
  <li>الوصول إلى الاستشارات والفعاليات المخصصة</li>
</ul>

<p style="text-align:center;margin:28px 0">
  <a href="/membership" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">جدّد عضويتك الآن</a>
</p>

<p style="font-size:14px;color:#6b7280">
  شكراً لكونك جزءاً من مجتمعنا 🙌<br>
  فريق مجلس رواد الأعمال العماني
</p>`,
  },
  {
    id: 'general-reminder',
    category: 'reminder',
    icon: 'Bell',
    name: 'تذكير عام',
    description: 'تذكير مختصر بأي موعد أو إجراء',
    subject: 'تذكير سريع 🔔',
    htmlBody: `<p style="font-size:15px;line-height:1.9">
  نودّ تذكيرك بأمرٍ مهمّ يخصّك:
</p>

<div style="background:#EFF6FF;border-inline-start:4px solid #1B3A6B;padding:16px;margin:20px 0;border-radius:6px;font-size:15px;line-height:1.9">
  <strong style="color:#1B3A6B">[العنوان]</strong><br>
  [التفاصيل الكاملة للتذكير]
</div>

<p style="text-align:center;margin:24px 0">
  <a href="[الرابط]" style="display:inline-block;background:#1B3A6B;color:#fff;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:600">اتخاذ إجراء</a>
</p>

<p style="font-size:14px;color:#6b7280">
  إن كنت قد أنجزت الأمر مسبقاً، تجاهل هذه الرسالة.<br>
  فريق مجلس رواد الأعمال العماني
</p>`,
  },
  {
    id: 'event-invitation',
    category: 'event',
    icon: 'Calendar',
    name: 'دعوة لفعالية',
    description: 'دعوة أعضاء المنصّة لحضور ورشة عمل أو ندوة',
    subject: '📅 دعوة خاصة لحضور [اسم الفعالية]',
    htmlBody: `<p style="font-size:15px;line-height:1.9">
  يشرّفنا دعوتك لحضور فعالية حصرية لأعضاء مجلس رواد الأعمال العماني.
</p>

<div style="background:linear-gradient(135deg,#1B3A6B11,#C9A84C11);border:1px solid #1B3A6B22;border-radius:12px;padding:20px;margin:20px 0">
  <h3 style="color:#1B3A6B;margin:0 0 12px;font-size:18px">[اسم الفعالية]</h3>
  <div style="font-size:14px;color:#374151;line-height:2">
    📅 <strong>التاريخ:</strong> [التاريخ]<br>
    ⏰ <strong>الوقت:</strong> [الوقت]<br>
    📍 <strong>المكان:</strong> [المكان أو رابط الاجتماع]<br>
    👤 <strong>المتحدث:</strong> [الاسم]
  </div>
</div>

<p style="font-size:15px;line-height:1.9">
  <strong>ماذا ستكسب؟</strong><br>
  [اكتب أبرز ما يستفيده الحاضر من الفعالية]
</p>

<p style="text-align:center;margin:28px 0">
  <a href="[رابط التسجيل]" style="display:inline-block;background:#1B3A6B;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">أكّد حضورك</a>
</p>

<p style="font-size:13px;color:#9ca3af;text-align:center">
  المقاعد محدودة — سارع بالتسجيل
</p>`,
  },
  {
    id: 'welcome',
    category: 'welcome',
    icon: 'Heart',
    name: 'ترحيب بالأعضاء الجدد',
    description: 'رسالة ترحيبية للأعضاء المُسجَّلين حديثاً',
    subject: 'أهلاً بك في مجلس رواد الأعمال العماني 🌟',
    htmlBody: `<p style="font-size:16px;line-height:1.9">
  يسعدنا انضمامك إلى مجتمعنا! نحن هنا لنساعدك على تنمية أعمالك وبناء شبكة علاقاتك.
</p>

<h3 style="color:#1B3A6B;margin:20px 0 10px;font-size:17px">🚀 خطواتك الأولى</h3>
<ol style="padding-inline-start:20px;font-size:15px;line-height:1.9">
  <li><a href="/dashboard/profile" style="color:#1B3A6B">أكمل ملفك الشخصي</a></li>
  <li><a href="/directory" style="color:#1B3A6B">تصفّح دليل الشركات</a></li>
  <li><a href="/consultations" style="color:#1B3A6B">احجز أول استشارة</a></li>
  <li><a href="/help" style="color:#1B3A6B">تعرّف على دليل الاستخدام</a></li>
</ol>

<div style="background:#F8F9FA;padding:16px;border-radius:8px;margin:20px 0;font-size:14px;color:#374151">
  💡 <strong>نصيحة:</strong> فعّل الإشعارات لتصلك فرص الاستشارات والعروض الحصرية.
</div>

<p style="font-size:15px;line-height:1.9">
  إن احتجت أي مساعدة، فريقنا في خدمتك على مدار الساعة.
</p>

<p style="font-size:14px;color:#6b7280">
  رحلة موفّقة 🌱<br>
  فريق مجلس رواد الأعمال العماني
</p>`,
  },
]
