import Link from 'next/link'
import { COMPANY } from '@/lib/company'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'سياسة الشحن والتوصيل | مجلس رواد الأعمال العماني',
  description: 'مدة الشحن وتكلفة التوصيل في سلطنة عُمان',
}

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
        <ArrowRight className="h-4 w-4 rotate-180" /> الرجوع للرئيسية
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-[#1B3A6B]">سياسة الشحن والتوصيل</h1>
      <p className="mb-8 text-sm text-gray-500">آخر تحديث: {COMPANY.lastUpdated}</p>

      <div className="space-y-6 text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_p]:leading-relaxed">
        <p>تلتزم <strong>{COMPANY.nameAr}</strong> بتوصيل الطلبات في أسرع وقت ممكن وبجودة عالية إلى جميع محافظات سلطنة عُمان.</p>

        <h2>1. مدة التوصيل</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#1B3A6B] text-white">
              <tr>
                <th className="border border-gray-300 p-2 text-right">المنطقة</th>
                <th className="border border-gray-300 p-2 text-right">مدة التجهيز</th>
                <th className="border border-gray-300 p-2 text-right">مدة الشحن</th>
                <th className="border border-gray-300 p-2 text-right">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">محافظة مسقط</td>
                <td className="border border-gray-300 p-2">1-2 يوم عمل</td>
                <td className="border border-gray-300 p-2">1-2 يوم عمل</td>
                <td className="border border-gray-300 p-2"><strong>2-4 أيام</strong></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 p-2">باقي المحافظات</td>
                <td className="border border-gray-300 p-2">1-2 يوم عمل</td>
                <td className="border border-gray-300 p-2">2-5 أيام عمل</td>
                <td className="border border-gray-300 p-2"><strong>3-7 أيام</strong></td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">المناطق الجبلية والنائية</td>
                <td className="border border-gray-300 p-2">1-2 يوم عمل</td>
                <td className="border border-gray-300 p-2">4-7 أيام عمل</td>
                <td className="border border-gray-300 p-2"><strong>5-9 أيام</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>2. تكلفة الشحن</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li><strong>محافظة مسقط:</strong> 2 ر.ع للطلب الواحد.</li>
          <li><strong>خارج مسقط (داخل عُمان):</strong> 3 ر.ع للطلب الواحد.</li>
          <li><strong>🎁 شحن مجاني:</strong> للطلبات التي تزيد قيمتها على <strong>30 ر.ع</strong>.</li>
          <li><strong>تحمل البائع:</strong> بعض البائعين يتحملون تكلفة الشحن (سترى تنبيهاً واضحاً في صفحة المنتج).</li>
        </ul>

        <h2>3. أوقات التوصيل</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>أيام العمل: الأحد - الخميس من 8:00 صباحاً إلى 6:00 مساءاً.</li>
          <li>لا يتم التوصيل أيام الجمعة والسبت والأعياد الرسمية.</li>
          <li>خلال المواسم (رمضان، أعياد) قد تتأخر التوصيلات لذلك نوصي بالطلب مبكراً.</li>
        </ul>

        <h2>4. تتبع الطلب</h2>
        <p>بعد شحن طلبك ستصلك رسالة إيميل تحتوي على <strong>رقم التتبع</strong> واسم شركة الشحن. يمكنك أيضاً متابعة حالة طلبك من <Link href="/orders" className="text-[#1B3A6B] underline">لوحة التحكم</Link>.</p>

        <h2>5. حالات التأخير</h2>
        <p>قد تتأخر الشحنة لأسباب خارجة عن إرادتنا مثل:</p>
        <ul className="list-disc space-y-1 pr-6">
          <li>الأحوال الجوية (أمطار، أعاصير).</li>
          <li>الأعياد والإجازات الرسمية.</li>
          <li>عنوان توصيل غير دقيق أو عدم الرد على التواصل.</li>
          <li>أعطال في أنظمة الشحن.</li>
        </ul>
        <p>في هذه الحالات، سنتواصل معك فوراً ونقدم حلولاً مناسبة.</p>

        <h2>6. التوصيل إلى دول أخرى</h2>
        <p>حالياً نقدم الشحن <strong>داخل سلطنة عُمان فقط</strong>. خدمة الشحن إلى دول مجلس التعاون قيد التطوير وستكون متاحة قريباً إن شاء الله.</p>

        <h2>7. تجربة المنتج قبل الدفع (للدفع عند الاستلام)</h2>
        <p>يحق لك فحص المنتج من الخارج (التغليف، الوزن، أو أي تلف ظاهر). في حال وجود مشكلة، يمكنك رفض الطلب ولن يُخصم منك أي مبلغ.</p>

        <h2>8. التواصل</h2>
        <ul className="list-none space-y-1">
          <li>📧 <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
          <li>📞 واتساب: <span dir="ltr">{COMPANY.phone}</span></li>
          <li>🏢 {COMPANY.address}</li>
        </ul>
      </div>
    </div>
  )
}
