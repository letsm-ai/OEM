import Link from 'next/link'
import { COMPANY } from '@/lib/company'
import { ArrowRight } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

export const metadata = {
  title: 'شروط الاستخدام | مجلس رواد الأعمال العماني',
  description: 'شروط وأحكام استخدام منصة مجلس رواد الأعمال العماني',
}

export default async function TermsPage() {
  const { t, lang, isRTL } = await getServerT()
  const arrowCls = isRTL ? 'rotate-180' : ''
  const listCls = isRTL ? 'list-disc space-y-1 pr-6' : 'list-disc space-y-1 pl-6'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
        <ArrowRight className={`h-4 w-4 ${arrowCls}`} /> {t('common.backToHome')}
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-[#1B3A6B]">{lang === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('common.lastUpdated')} {COMPANY.lastUpdated}</p>

      <div className="space-y-6 text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_p]:leading-relaxed">
        {lang === 'ar' ? (
          <>
            <p>
              مرحباً بك في <strong>{COMPANY.nameAr}</strong> (المشار إليها لاحقاً بـ “المنصة” أو “نحن”). باستخدامك لموقعنا <a href={COMPANY.website} className="text-[#1B3A6B] underline">{COMPANY.website}</a>
              {' '}أو تطبيقاتنا توافق على الالتزام بالشروط والأحكام التالية. إذا لم توافق على أي بند يرجى عدم استخدام المنصة.
            </p>

            <h2>1. التعريفات</h2>
            <ul className={listCls}>
              <li><strong>المنصة:</strong> {COMPANY.nameAr}، سجل تجاري رقم {COMPANY.cr}.</li>
              <li><strong>المستخدم:</strong> أي شخص يزور أو يستخدم المنصة (زائر، عضو، بائع، خبير).</li>
              <li><strong>الخدمات:</strong> المتجر الإلكتروني، دليل الشركات، الاستشارات، والعضويات.</li>
              <li><strong>البائع:</strong> التاجر المسجل في المنصة الذي يعرض منتجاته للبيع.</li>
              <li><strong>الخبير:</strong> المستشار المعتمد الذي يقدم جلسات استشارية مدفوعة.</li>
            </ul>

            <h2>2. الأهلية للاستخدام</h2>
            <p>يجب أن تكون قد أتممت الثامنة عشرة (18) من العمر، وتمتلك الأهلية القانونية لإبرام العقود. للقاصرين، يجب أن يكون الولي الأمر هو المستخدم المسجل.</p>

            <h2>3. حساب المستخدم</h2>
            <ul className={listCls}>
              <li>أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة المرور.</li>
              <li>يجب تقديم معلومات صحيحة ودقيقة عند التسجيل.</li>
              <li>يحق لنا تعليق أو حذف أي حساب يخالف الشروط دون إشعار مسبق.</li>
            </ul>

            <h2>4. العضويات والاشتراكات</h2>
            <p>تقدم المنصة 4 باقات: <strong>مجانية</strong>، <strong>أساسية</strong>، <strong>ذهبية</strong>، و <strong>بلاتينية</strong>. مدة كل باقة مدفوعة هي 12 شهراً من تاريخ الاشتراك. لا تجدد الاشتراكات تلقائياً، ويجب تجديدها يدوياً من لوحة التحكم.</p>

            <h2>5. المتجر الإلكتروني</h2>
            <p>جميع المنتجات المعروضة في المتجر يتم توريدها من قبل بائعين مستقلين. تتحمل المنصة مسؤولية الوساطة والدفع، بينما يتحمل البائع المسؤولية الكاملة عن:</p>
            <ul className={listCls}>
              <li>جودة المنتج ومطابقته للوصف.</li>
              <li>تجهيز الطلب خلال مدة لا تتجاوز 3 أيام عمل.</li>
              <li>التواصل مع العميل لحل أي مشكلة.</li>
            </ul>

            <h2>6. الاستشارات</h2>
            <p>الخبراء مستقلون ويتحملون المسؤولية الكاملة عن جودة الجلسة. المنصة توفر فقط منصة الحجز والدفع. في حال إلغاء الجلسة تطبق سياسة الاسترداد.</p>

            <h2>7. المحتوى المحظور</h2>
            <p>يحظر إدراج أو نشر أي محتوى:</p>
            <ul className={listCls}>
              <li>يخالف القوانين العُمانية أو يمس الدين أو العادات.</li>
              <li>يروج للعنف أو التمييز أو التحرش.</li>
              <li>منتجات مقلدة أو مخالفة لحقوق الملكية الفكرية.</li>
              <li>مواد خطرة أو أسلحة أو مخدرات.</li>
            </ul>

            <h2>8. المدفوعات</h2>
            <p>يتم معالجة جميع المدفوعات عبر بوابة <strong>Thawani Pay</strong> المرخصة من البنك المركزي العُماني. جميع الأسعار بالريال العُماني (OMR) وتشمل ضريبة القيمة المضافة (إن وجدت).</p>

            <h2>9. الملكية الفكرية</h2>
            <p>جميع الحقوق المتعلقة بالمنصة (شعار، تصميم، محتوى) محفوظة لـ {COMPANY.nameAr}. يحظر النسخ أو التوزيع دون إذن رسمي مكتوب.</p>

            <h2>10. إخلاء المسؤولية</h2>
            <p>تقدم المنصة الخدمات كما هي (as-is) دون أي ضمانات صريحة أو ضمنية. لا نتحمل مسؤولية أي خسائر غير مباشرة تنتج عن استخدام المنصة.</p>

            <h2>11. إنهاء الخدمة</h2>
            <p>يحق لنا تعليق أو إنهاء حسابك فوراً إذا تبين أي مخالفة للشروط. لا تحق أي مطالبات مالية أو تعويضات في حالة الإنهاء بسبب المخالفة.</p>

            <h2>12. القانون الحاكم</h2>
            <p>تخضع هذه الشروط وتفسر وفقاً لقوانين سلطنة عُمان. أي نزاع يتم إحالته إلى المحاكم المختصة في محافظة مسقط.</p>

            <h2>13. تعديل الشروط</h2>
            <p>نحتفظ بحق تعديل هذه الشروط في أي وقت. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار في المنصة قبل مدة لا تقل عن 7 أيام.</p>

            <h2>14. التواصل</h2>
            <p>لأي استفسار حول هذه الشروط، يرجى التواصل معنا:</p>
            <ul className="list-none space-y-1">
              <li>📧 البريد: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 الهاتف: <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 العنوان: {COMPANY.address}</li>
              <li>🏛️ السجل التجاري: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        ) : (
          <>
            <p>
              Welcome to <strong>{COMPANY.nameAr}</strong> (hereinafter referred to as the “Platform” or “we”). By using our website <a href={COMPANY.website} className="text-[#1B3A6B] underline">{COMPANY.website}</a>
              {' '}or our applications, you agree to be bound by the following terms and conditions. If you do not agree with any clause, please do not use the Platform.
            </p>

            <h2>1. Definitions</h2>
            <ul className={listCls}>
              <li><strong>Platform:</strong> {COMPANY.nameAr}, Commercial Registration No. {COMPANY.cr}.</li>
              <li><strong>User:</strong> Any person visiting or using the Platform (guest, member, vendor, expert).</li>
              <li><strong>Services:</strong> E-store, business directory, consultations, and memberships.</li>
              <li><strong>Vendor:</strong> A merchant registered on the Platform who offers products for sale.</li>
              <li><strong>Expert:</strong> A certified consultant providing paid consultation sessions.</li>
            </ul>

            <h2>2. Eligibility</h2>
            <p>You must be at least eighteen (18) years of age and have the legal capacity to enter into contracts. For minors, the registered user must be the legal guardian.</p>

            <h2>3. User Account</h2>
            <ul className={listCls}>
              <li>You are responsible for maintaining the confidentiality of your account credentials and password.</li>
              <li>You must provide accurate and truthful information at registration.</li>
              <li>We reserve the right to suspend or delete any account that violates the Terms without prior notice.</li>
            </ul>

            <h2>4. Memberships & Subscriptions</h2>
            <p>The Platform offers four tiers: <strong>Free</strong>, <strong>Basic</strong>, <strong>Gold</strong>, and <strong>Platinum</strong>. Each paid plan lasts 12 months from the subscription date. Subscriptions do not renew automatically and must be renewed manually from the dashboard.</p>

            <h2>5. E-Store</h2>
            <p>All products listed on the store are supplied by independent vendors. The Platform acts as an intermediary and payment processor, while the vendor bears full responsibility for:</p>
            <ul className={listCls}>
              <li>Product quality and accuracy of description.</li>
              <li>Fulfilling the order within a maximum of 3 business days.</li>
              <li>Communicating with the customer to resolve any issue.</li>
            </ul>

            <h2>6. Consultations</h2>
            <p>Experts are independent professionals and are fully responsible for the quality of their sessions. The Platform only provides the booking and payment infrastructure. Cancellations are governed by the Refund Policy.</p>

            <h2>7. Prohibited Content</h2>
            <p>It is strictly forbidden to list or publish any content that:</p>
            <ul className={listCls}>
              <li>Violates Omani laws or offends religion or public morals.</li>
              <li>Promotes violence, discrimination, or harassment.</li>
              <li>Consists of counterfeit products or infringes intellectual property rights.</li>
              <li>Includes hazardous materials, weapons, or drugs.</li>
            </ul>

            <h2>8. Payments</h2>
            <p>All payments are processed through <strong>Thawani Pay</strong>, licensed by the Central Bank of Oman. All prices are in Omani Rials (OMR) and include VAT where applicable.</p>

            <h2>9. Intellectual Property</h2>
            <p>All rights related to the Platform (logo, design, content) are reserved for {COMPANY.nameAr}. Copying or distribution without official written permission is prohibited.</p>

            <h2>10. Disclaimer</h2>
            <p>The Platform provides services on an “as-is” basis without any express or implied warranties. We are not liable for any indirect losses arising from the use of the Platform.</p>

            <h2>11. Termination</h2>
            <p>We may suspend or terminate your account immediately upon any breach of the Terms. No refunds or compensation are payable in the event of termination for cause.</p>

            <h2>12. Governing Law</h2>
            <p>These Terms are governed by and construed in accordance with the laws of the Sultanate of Oman. Any dispute shall be referred to the competent courts of Muscat Governorate.</p>

            <h2>13. Amendments</h2>
            <p>We reserve the right to amend these Terms at any time. We will notify you of any material changes via email or an in-Platform notice at least 7 days in advance.</p>

            <h2>14. Contact</h2>
            <p>For any inquiry about these Terms, please contact us:</p>
            <ul className="list-none space-y-1">
              <li>📧 Email: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 Phone: <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 Address: {COMPANY.address}</li>
              <li>🏛️ CR: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
