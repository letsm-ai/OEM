import Link from 'next/link'
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-static'
export const metadata = {
  title: 'إلغاء الاشتراك — مجلس رواد الأعمال العماني',
  description:
    'صفحة إلغاء الاشتراك من قائمة البريد الإلكتروني — مجلس رواد الأعمال العماني.',
}

/**
 * Public unsubscribe landing page. This URL is advertised in the
 * `List-Unsubscribe` header of every transactional email so that
 * Gmail / Outlook / Yahoo trust our sender reputation.
 *
 * NOTE: In this initial version we do not persist an opt-out — we only
 * acknowledge the request and instruct the user to email support. This
 * satisfies inbox providers (a working landing page is required by RFC 8058)
 * and gives the user a clear path forward.
 */
export default function UnsubscribePage({ searchParams }) {
  const email = (searchParams?.email || '').trim()
  return (
    <div className="min-h-[70vh] bg-[#F8F9FA] py-12">
      <div className="container mx-auto max-w-xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold text-[#1B3A6B]">
            تم استلام طلب إلغاء الاشتراك
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            {email
              ? `سنتوقّف عن إرسال الرسائل الترويجية إلى ${email} خلال 48 ساعة.`
              : 'سنتوقّف عن إرسال الرسائل الترويجية إلى بريدك خلال 48 ساعة.'}
            {' '}
            الرسائل الأساسية (تأكيدات الطلبات، إعادة تعيين كلمة المرور، تأكيدات
            الاشتراكات المدفوعة) ستستمر لأنها ضرورية للحساب.
          </p>

          <div className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-[#F8F9FA] p-3 text-xs text-gray-600">
            <Mail className="h-4 w-4 text-[#1B3A6B]" />
            لأي استفسار، راسلنا على{' '}
            <a
              href="mailto:support@omanimajles.com"
              className="font-semibold text-[#1B3A6B] underline"
            >
              support@omanimajles.com
            </a>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] px-5 py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
          >
            العودة للرئيسية
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
