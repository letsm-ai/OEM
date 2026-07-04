import Link from 'next/link'
import { COMPANY } from '@/lib/company'
import { ArrowRight } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

export const metadata = {
  title: 'سياسة الإرجاع والاسترداد | مجلس رواد الأعمال العماني',
  description: 'شروط إرجاع المنتجات واسترداد المدفوعات',
}

export default async function RefundPage() {
  const { t, lang, isRTL } = await getServerT()
  const arrowCls = isRTL ? 'rotate-180' : ''
  const listCls = isRTL ? 'list-disc space-y-1 pr-6' : 'list-disc space-y-1 pl-6'
  const borderSide = isRTL ? 'border-r-4' : 'border-l-4'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline">
        <ArrowRight className={`h-4 w-4 ${arrowCls}`} /> {t('common.backToHome')}
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-[#1B3A6B]">{lang === 'ar' ? 'سياسة الإرجاع والاسترداد' : 'Return & Refund Policy'}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('common.lastUpdated')} {COMPANY.lastUpdated}</p>

      <div className="space-y-6 text-gray-700 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_p]:leading-relaxed">
        {lang === 'ar' ? (
          <>
            <p>شكراً لتسوقك في <strong>{COMPANY.nameAr}</strong>. إذا لم تكن راضياً عن منتج أو خدمة، فإننا ندعوك لمراجعة السياسة أدناه.</p>
            <h2>1. حق إلغاء الطلب</h2>
            <p>يحق لك إلغاء طلبك خلال <strong>14 يوماً</strong> دون إبداء أي سبب. تبدأ المدة من تاريخ استلامك للمنتج أو استلام أي طرف ثالث مفوّض من قبلك.</p>
            <p>لإلغاء الطلب، أرسل إلينا إيميلاً واضحاً على: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a> يتضمن رقم الطلب وسبب الإلغاء (اختياري).</p>
            <h2>2. مدة الاسترداد</h2>
            <p>سيتم رد المبلغ إليك خلال <strong>14 يوماً كحد أقصى</strong> من تاريخ استلامنا للمنتج المرجّع. يتم الرد بنفس وسيلة الدفع التي استخدمتها (عبر Thawani Pay)، دون أي رسوم إضافية.</p>
            <h2>3. شروط الإرجاع</h2>
            <p>لقبول الإرجاع، يجب توفر الشروط التالية:</p>
            <ul className={listCls}>
              <li>تم شراء المنتج خلال آخر <strong>14 يوماً</strong>.</li>
              <li>المنتج في تغليفه الأصلي غير مفتوح.</li>
              <li>المنتج لم يُستخدم ولم يتلف.</li>
              <li>وجود إيصال الشراء أو رقم الطلب.</li>
            </ul>
            <h2>4. منتجات غير قابلة للإرجاع</h2>
            <ul className={listCls}>
              <li>المنتجات المخصصة حسب طلبك (تطريز، نقش، إلخ).</li>
              <li>المنتجات سريعة التلف أو منتهية الصلاحية (أطعمة طازجة).</li>
              <li>منتجات النظافة الشخصية والتجميل بعد فتح التغليف.</li>
              <li>المنتجات الرقمية بعد التنزيل.</li>
              <li>المنتجات المخفّضة (أو بتخفيضات) ما لم يُنص قانونياً.</li>
            </ul>
            <h2>5. إرجاع المنتج</h2>
            <p>تتحمل تكلفة ومخاطر إعادة إرسال المنتج إلينا. أرسل المنتج إلى العنوان التالي:</p>
            <div className={`my-3 rounded-lg bg-gray-50 p-4 ${borderSide} border-[#C9A84C]`}>
              <p className="font-bold">{COMPANY.nameAr}</p>
              <p>{COMPANY.address}</p>
              <p dir="ltr" className="mt-1 text-sm text-gray-600">{COMPANY.addressEn}</p>
            </div>
            <p className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">⚠️ <strong>توصية:</strong> استخدم شركة شحن موثوقة مع رقم تتبع وتأمين. لا نتحمل مسؤولية المنتجات التالفة أو المفقودة أثناء الإرجاع.</p>
            <h2>6. التبديل</h2>
            <p>في حال استلمت منتجاً تالفاً أو معيباً، تواصل معنا خلال 24 ساعة مع إرفاق صور توضح العيب. سنقوم بتبديله مجاناً أو رد المبلغ كاملاً.</p>
            <h2>7. الاستشارات</h2>
            <ul className={listCls}>
              <li>يمكن إلغاء الجلسة قبل <strong>24 ساعة</strong> من موعدها مع استرداد كامل 100%.</li>
              <li>الإلغاء قبل 6-24 ساعة: استرداد 50%.</li>
              <li>الإلغاء قبل أقل من 6 ساعات أو عدم الحضور: لا يحق الاسترداد.</li>
              <li>إذا ألغى الخبير الجلسة لأي سبب: <strong>استرداد كامل فوري</strong>.</li>
            </ul>
            <h2>8. العضويات والاشتراكات</h2>
            <ul className={listCls}>
              <li>يحق لك طلب استرداد الاشتراك خلال <strong>7 أيام</strong> من تاريخ الاشتراك إذا لم تستخدم أي من الخدمات المخصصة للأعضاء.</li>
              <li>بعد 7 أيام أو في حال استخدام أي خدمة حصرية: لا يحق الاسترداد.</li>
              <li>يمكنك إيقاف التجديد التالي في أي وقت (تجديداتنا يدوية فقط).</li>
            </ul>
            <h2>9. المدفوعات المتنازع عليها</h2>
            <p>إذا رأيت خصماً لم تقم به، تواصل معنا فوراً. سنحقق في الأمر خلال <strong>48 ساعة</strong> وإذا ثبت الخطأ سيُرد المبلغ بالكامل.</p>
            <h2>10. الهدايا</h2>
            <p>للمنتجات المشتراة كهدية ومرسلة لك مباشرة: ستحصل على رصيد هدية بقيمة الإرجاع. إذا لم تكن مرجّلة كهدية، سيُرد المبلغ للمرسل الأصلي.</p>
            <h2>11. التواصل معنا</h2>
            <ul className="list-none space-y-1">
              <li>📧 البريد: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 الهاتف/واتساب: <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 العنوان: {COMPANY.address}</li>
              <li>🏛️ السجل التجاري: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        ) : (
          <>
            <p>Thank you for shopping at <strong>{COMPANY.nameAr}</strong>. If you are not satisfied with a product or service, please review the policy below.</p>
            <h2>1. Right to Cancel</h2>
            <p>You have the right to cancel your order within <strong>14 days</strong> without giving any reason. The period starts from the date you receive the product or the date any authorised third party receives it on your behalf.</p>
            <p>To cancel, send us a clear email at: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a> including the order number and (optionally) the reason for cancellation.</p>
            <h2>2. Refund Timeline</h2>
            <p>The amount will be refunded to you within <strong>14 days maximum</strong> from the date we receive the returned product. Refunds are issued via the same payment method you used (through Thawani Pay) with no additional fees.</p>
            <h2>3. Return Conditions</h2>
            <p>To be eligible for a return, the following conditions must be met:</p>
            <ul className={listCls}>
              <li>The product was purchased within the last <strong>14 days</strong>.</li>
              <li>The product is in its original, unopened packaging.</li>
              <li>The product has not been used and is undamaged.</li>
              <li>You provide the purchase receipt or order number.</li>
            </ul>
            <h2>4. Non-Returnable Items</h2>
            <ul className={listCls}>
              <li>Custom-made items (embroidery, engraving, etc.).</li>
              <li>Perishable or expired products (fresh food).</li>
              <li>Personal hygiene and cosmetic products once opened.</li>
              <li>Digital products after download.</li>
              <li>Discounted / sale items, unless otherwise required by law.</li>
            </ul>
            <h2>5. Returning the Product</h2>
            <p>You bear the cost and risk of sending the product back to us. Ship the product to the following address:</p>
            <div className={`my-3 rounded-lg bg-gray-50 p-4 ${borderSide} border-[#C9A84C]`}>
              <p className="font-bold">{COMPANY.nameAr}</p>
              <p>{COMPANY.address}</p>
              <p dir="ltr" className="mt-1 text-sm text-gray-600">{COMPANY.addressEn}</p>
            </div>
            <p className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">⚠️ <strong>Tip:</strong> use a reliable courier with tracking and insurance. We are not liable for products damaged or lost during the return shipment.</p>
            <h2>6. Exchanges</h2>
            <p>If you receive a damaged or defective product, contact us within 24 hours with photos showing the defect. We will replace it free of charge or issue a full refund.</p>
            <h2>7. Consultations</h2>
            <ul className={listCls}>
              <li>You may cancel a session up to <strong>24 hours</strong> before it starts for a full 100% refund.</li>
              <li>Cancellations 6–24 hours before: 50% refund.</li>
              <li>Cancellations less than 6 hours before or no-shows: no refund.</li>
              <li>If the expert cancels the session for any reason: <strong>immediate full refund</strong>.</li>
            </ul>
            <h2>8. Memberships & Subscriptions</h2>
            <ul className={listCls}>
              <li>You may request a subscription refund within <strong>7 days</strong> of subscribing, provided you have not used any member-only service.</li>
              <li>After 7 days, or if any exclusive service is used: no refund.</li>
              <li>You can disable the next renewal at any time (all our renewals are manual anyway).</li>
            </ul>
            <h2>9. Disputed Payments</h2>
            <p>If you notice a charge you did not authorize, contact us immediately. We will investigate within <strong>48 hours</strong> and refund the amount in full if the error is confirmed.</p>
            <h2>10. Gifts</h2>
            <p>For products purchased as gifts and shipped directly to you: you will receive a gift credit equal to the return value. If not marked as a gift, the amount will be refunded to the original sender.</p>
            <h2>11. Contact</h2>
            <ul className="list-none space-y-1">
              <li>📧 Email: <a href={`mailto:${COMPANY.supportEmail}`} className="text-[#1B3A6B] underline" dir="ltr">{COMPANY.supportEmail}</a></li>
              <li>📞 Phone/WhatsApp: <span dir="ltr">{COMPANY.phone}</span></li>
              <li>🏢 Address: {COMPANY.address}</li>
              <li>🏛️ CR: <span dir="ltr">{COMPANY.cr}</span></li>
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
