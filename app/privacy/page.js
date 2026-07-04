import Link from 'next/link'
import { COMPANY } from '@/lib/company'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'سياسة الخصوصية | مجلس رواد الأعمال العماني',
  description: 'كيف نجمع ونستخدم ونحمي بياناتك في منصة مجلس رواد الأعمال العماني',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
        <ArrowRight className="h-4 w-4 rotate-180" /> الرجوع للرئيسية
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-[#1B3A6B]">سياسة الخصوصية</h1>
      <p className="mb-8 text-sm text-gray-500">آخر تحديث: {COMPANY.lastUpdated}</p>

      <div className="space-y-6 text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_p]:leading-relaxed">
        <p>
          تلتزم <strong>{COMPANY.nameAr}</strong> بحماية خصوصيتك وفقاً لقانون حماية البيانات الشخصية العُماني (مرسوم سلطاني رقم 6/2022). توضح هذه الوثيقة طرق جمع واستخدام وحماية معلوماتك عند استخدام المنصة.
        </p>

        <h2>1. المعلومات التي نجمعها</h2>
        <h3 className="text-lg font-bold text-gray-800">أ) معلومات تقدمها طوعاً:</h3>
        <ul className="list-disc space-y-1 pr-6">
          <li>الاسم الكامل والبريد الإلكتروني ورقم الهاتف.</li>
          <li>عنوان الشحن والمحافظة.</li>
          <li>معلومات الدفع (تُعالج حصرياً عبر <strong>Thawani Pay</strong>، ولا تُخزن لدينا أرقام البطاقات).</li>
          <li>محتوى الرسائل والتقييمات التي تنشرها.</li>
        </ul>
        <h3 className="text-lg font-bold text-gray-800">ب) معلومات تلقائية:</h3>
        <ul className="list-disc space-y-1 pr-6">
          <li>عنوان IP، نوع المتصفح، ونظام التشغيل.</li>
          <li>الصفحات التي تزورها ومدة الزيارة (عبر Google Analytics 4).</li>
          <li>ملفات تعريف الارتباط (Cookies).</li>
        </ul>

        <h2>2. كيف نستخدم معلوماتك</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>معالجة الطلبات وتوصيل المنتجات.</li>
          <li>تأكيد الحجوزات وإدارة الاشتراكات.</li>
          <li>التواصل معك لدعم العملاء.</li>
          <li>إرسال إشعارات مهمة (تأكيد، استرداد، امتلاء جلسة).</li>
          <li>تحسين تجربة المستخدم وتحليل الأداء.</li>
          <li>منع الاحتيال وحماية المنصة.</li>
        </ul>

        <h2>3. مشاركة المعلومات</h2>
        <p><strong>لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث</strong>. مشاركة البيانات تتم فقط مع:</p>
        <ul className="list-disc space-y-1 pr-6">
          <li><strong>البائعين:</strong> يحصلون على الاسم، العنوان، ورقم الهاتف لإتمام الشحن فقط.</li>
          <li><strong>شركات الشحن:</strong> للتوصيل الفعلي.</li>
          <li><strong>Thawani Pay:</strong> لمعالجة الدفع.</li>
          <li><strong>Google Analytics:</strong> إحصاءيات مجهولة الهوية.</li>
          <li><strong>Resend:</strong> لإرسال إيميلات المعاملات.</li>
          <li><strong>السلطات الحكومية:</strong> فقط عند طلب قانوني رسمي.</li>
        </ul>

        <h2>4. ملفات تعريف الارتباط (Cookies)</h2>
        <p>نستخدم الكوكيز لـ:</p>
        <ul className="list-disc space-y-1 pr-6">
          <li>تذكر معلومات تسجيل الدخول.</li>
          <li>حفظ محتويات سلة التسوق.</li>
          <li>تحليل الحركة وتحسين التجربة.</li>
        </ul>
        <p>يمكنك تعطيل الكوكيز من إعدادات المتصفح، لكن ذلك قد يؤثر على وظائف المنصة.</p>

        <h2>5. حماية البيانات</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>تشفير كلمات المرور بـ bcrypt (12 جولة).</li>
          <li>اتصال HTTPS/SSL لجميع الصفحات.</li>
          <li>معالجة الدفع معتمدة PCI-DSS عبر Thawani.</li>
          <li>حماية CSRF و XSS.</li>
          <li>نسخ احتياطية يومية لقاعدة البيانات.</li>
        </ul>

        <h2>6. حقوقك كمستخدم</h2>
        <p>يحق لك:</p>
        <ul className="list-disc space-y-1 pr-6">
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
        <ul className="list-disc space-y-1 pr-6">
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
      </div>
    </div>
  )
}
