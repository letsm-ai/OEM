import Link from 'next/link'
import { COMPANY } from '@/lib/company'
import { ArrowRight } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

export const metadata = {
  title: 'سياسة الخصوصية | مجلس رواد الأعمال العماني',
  description: 'كيف نجمع ونستخدم ونحمي بياناتك في منصة مجلس رواد الأعمال العماني',
}

export default async function PrivacyPage() {
  const { t, lang, isRTL } = await getServerT()
  const arrowCls = isRTL ? 'rotate-180' : ''
  const listCls = isRTL ? 'list-disc space-y-1 pr-6' : 'list-disc space-y-1 pl-6'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
        <ArrowRight className={`h-4 w-4 ${arrowCls}`} /> {t('common.backToHome')}
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-[#1B3A6B]">{lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('common.lastUpdated')} {COMPANY.lastUpdated}</p>

      <div className="space-y-6 text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_p]:leading-relaxed">
        {lang === 'ar' ? (
          <>
            <p>
              تلتزم <strong>{COMPANY.nameAr}</strong> بحماية خصوصيتك وفقاً لقانون حماية البيانات الشخصية العُماني (مرسوم سلطاني رقم 6/2022). توضح هذه الوثيقة طرق جمع واستخدام وحماية معلوماتك عند استخدام المنصة.
            </p>
            <h2>1. المعلومات التي نجمعها</h2>
            <h3 className="text-lg font-bold text-gray-800">أ) معلومات تقدمها طوعاً:</h3>
            <ul className={listCls}>
              <li>الاسم الكامل والبريد الإلكتروني ورقم الهاتف.</li>
              <li>عنوان الشحن والمحافظة.</li>
              <li>معلومات الدفع (تُعالج حصرياً عبر <strong>Thawani Pay</strong>، ولا تُخزن لدينا أرقام البطاقات).</li>
              <li>محتوى الرسائل والتقييمات التي تنشرها.</li>
            </ul>
            <h3 className="text-lg font-bold text-gray-800">ب) معلومات تلقائية:</h3>
            <ul className={listCls}>
              <li>عنوان IP، نوع المتصفح، ونظام التشغيل.</li>
              <li>الصفحات التي تزورها ومدة الزيارة (عبر Google Analytics 4).</li>
              <li>ملفات تعريف الارتباط (Cookies).</li>
            </ul>
            <h2>2. كيف نستخدم معلوماتك</h2>
            <ul className={listCls}>
              <li>معالجة الطلبات وتوصيل المنتجات.</li>
              <li>تأكيد الحجوزات وإدارة الاشتراكات.</li>
              <li>التواصل معك لدعم العملاء.</li>
              <li>إرسال إشعارات مهمة (تأكيد، استرداد، امتلاء جلسة).</li>
              <li>تحسين تجربة المستخدم وتحليل الأداء.</li>
              <li>منع الاحتيال وحماية المنصة.</li>
            </ul>
            <h2>3. مشاركة المعلومات</h2>
            <p><strong>لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث</strong>. مشاركة البيانات تتم فقط مع:</p>
            <ul className={listCls}>
              <li><strong>البائعين:</strong> يحصلون على الاسم، العنوان، ورقم الهاتف لإتمام الشحن فقط.</li>
              <li><strong>شركات الشحن:</strong> للتوصيل الفعلي.</li>
              <li><strong>Thawani Pay:</strong> لمعالجة الدفع.</li>
              <li><strong>Google Analytics:</strong> إحصاءيات مجهولة الهوية.</li>
              <li><strong>Resend:</strong> لإرسال إيميلات المعاملات.</li>
              <li><strong>السلطات الحكومية:</strong> فقط عند طلب قانوني رسمي.</li>
            </ul>
            <h2>4. ملفات تعريف الارتباط (Cookies)</h2>
            <p>نستخدم الكوكيز لـ:</p>
            <ul className={listCls}>
              <li>تذكر معلومات تسجيل الدخول.</li>
              <li>حفظ محتويات سلة التسوق.</li>
              <li>تحليل الحركة وتحسين التجربة.</li>
            </ul>
            <p>يمكنك تعطيل الكوكيز من إعدادات المتصفح، لكن ذلك قد يؤثر على وظائف المنصة.</p>
            <h2>5. حماية البيانات</h2>
            <ul className={listCls}>
              <li>تشفير كلمات المرور بـ bcrypt (12 جولة).</li>
              <li>اتصال HTTPS/SSL لجميع الصفحات.</li>
              <li>معالجة الدفع معتمدة PCI-DSS عبر Thawani.</li>
              <li>حماية CSRF و XSS.</li>
              <li>نسخ احتياطية يومية لقاعدة البيانات.</li>
            </ul>
            <h2>6. حقوقك كمستخدم</h2>
            <p>يحق لك:</p>
            <ul className={listCls}>
              <li>معرفة ما هي البيانات المخزّنة عنك.</li>
              <li>طلب تصحيح أي معلومة خاطئة.</li>
              <li>طلب حذف حسابك وبياناتك بالكامل (ما عدا ما يتطلبه القانون حفظه).</li>
              <li>إلغاء الاشتراك في الإيميلات التسويقية.</li>
              <li>نقل بياناتك إلى خدمة أخرى (Data Portability).</li>
            </ul>
            <p>لممارسة أي من هذه الحقوق: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></p>
            <h2>7. القصر</h2>
            <p>المنصة موجهة لمن هم فوق 18 سنة. لا نجمع عمداً بيانات القصر. إذا اكتشفنا ذلك، سنحذف البيانات فوراً.</p>
            <h2>8. مدة الاحتفاظ بالبيانات</h2>
            <ul className={listCls}>
              <li>بيانات الحساب: طوال فترة نشاط الحساب + 12 شهراً.</li>
              <li>سجل الطلبات: 7 سنوات (متطلب قانوني محاسبي).</li>
              <li>الإيميلات: 24 شهراً في Resend.</li>
              <li>إحصاءيات الموقع: 14 شهراً في Google Analytics.</li>
            </ul>
            <h2>9. خدمات الطرف الثالث</h2>
            <p>قد تحتوي المنصة روابط لمواقع خارجية (مثل حسابات البائعين على وسائل التواصل). نحن غير مسؤولين عن سياسات الخصوصية لتلك المواقع.</p>
            <h2>10. تعديل السياسة</h2>
            <p>قد نحدّث هذه السياسة من وقت لآخر. سنخطرك بالتحديثات الجوهرية عبر الإيميل قبل تفعيلها بأسبوع.</p>
            <h2>11. التواصل</h2>
            <ul className="list-none space-y-1">
              <li>📧 <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 {COMPANY.address}</li>
              <li>🏛️ السجل التجاري: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        ) : (
          <>
            <p>
              <strong>{COMPANY.nameAr}</strong> is committed to protecting your privacy in accordance with the Omani Personal Data Protection Law (Royal Decree No. 6/2022). This document explains how we collect, use, and protect your information when you use the Platform.
            </p>
            <h2>1. Information We Collect</h2>
            <h3 className="text-lg font-bold text-gray-800">A) Information you provide voluntarily:</h3>
            <ul className={listCls}>
              <li>Full name, email address, and phone number.</li>
              <li>Shipping address and governorate.</li>
              <li>Payment information (processed exclusively via <strong>Thawani Pay</strong>; we do not store card numbers).</li>
              <li>Message content and reviews you publish.</li>
            </ul>
            <h3 className="text-lg font-bold text-gray-800">B) Automatically-collected information:</h3>
            <ul className={listCls}>
              <li>IP address, browser type, and operating system.</li>
              <li>Pages you visit and time spent (via Google Analytics 4).</li>
              <li>Cookies.</li>
            </ul>
            <h2>2. How We Use Your Information</h2>
            <ul className={listCls}>
              <li>Processing orders and delivering products.</li>
              <li>Confirming bookings and managing subscriptions.</li>
              <li>Communicating with you for customer support.</li>
              <li>Sending important notifications (confirmation, refund, session reminders).</li>
              <li>Improving user experience and analyzing performance.</li>
              <li>Preventing fraud and protecting the Platform.</li>
            </ul>
            <h2>3. Sharing of Information</h2>
            <p><strong>We do not sell or rent your personal data to any third party</strong>. Data sharing is limited to:</p>
            <ul className={listCls}>
              <li><strong>Vendors:</strong> Receive your name, address, and phone number solely to fulfill shipping.</li>
              <li><strong>Shipping companies:</strong> For physical delivery.</li>
              <li><strong>Thawani Pay:</strong> For payment processing.</li>
              <li><strong>Google Analytics:</strong> Anonymous statistics.</li>
              <li><strong>Resend:</strong> For sending transactional emails.</li>
              <li><strong>Government authorities:</strong> Only upon formal legal request.</li>
            </ul>
            <h2>4. Cookies</h2>
            <p>We use cookies to:</p>
            <ul className={listCls}>
              <li>Remember login information.</li>
              <li>Persist shopping cart contents.</li>
              <li>Analyze traffic and improve the experience.</li>
            </ul>
            <p>You can disable cookies from your browser settings, but this may affect Platform functionality.</p>
            <h2>5. Data Protection</h2>
            <ul className={listCls}>
              <li>Passwords hashed with bcrypt (12 rounds).</li>
              <li>HTTPS/SSL connection on all pages.</li>
              <li>PCI-DSS certified payment processing via Thawani.</li>
              <li>CSRF and XSS protection.</li>
              <li>Daily database backups.</li>
            </ul>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className={listCls}>
              <li>Know what data is stored about you.</li>
              <li>Request correction of any inaccurate information.</li>
              <li>Request full deletion of your account and data (except what the law requires us to keep).</li>
              <li>Unsubscribe from marketing emails.</li>
              <li>Data portability to another service.</li>
            </ul>
            <p>To exercise any of these rights: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></p>
            <h2>7. Minors</h2>
            <p>The Platform is intended for users above 18 years of age. We do not knowingly collect data from minors. If discovered, we delete the data immediately.</p>
            <h2>8. Data Retention</h2>
            <ul className={listCls}>
              <li>Account data: for the duration of the account activity + 12 months.</li>
              <li>Order history: 7 years (accounting law requirement).</li>
              <li>Emails: 24 months in Resend.</li>
              <li>Site analytics: 14 months in Google Analytics.</li>
            </ul>
            <h2>9. Third-Party Services</h2>
            <p>The Platform may contain links to external sites (e.g. vendors’ social accounts). We are not responsible for the privacy policies of those sites.</p>
            <h2>10. Policy Amendments</h2>
            <p>We may update this policy from time to time. We will notify you of material changes via email one week before they take effect.</p>
            <h2>11. Contact</h2>
            <ul className="list-none space-y-1">
              <li>📧 <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 {COMPANY.address}</li>
              <li>🏛️ CR: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
