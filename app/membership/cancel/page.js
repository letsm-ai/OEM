'use client'

import Link from 'next/link'
import { XCircle, ArrowRight, Crown } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'

export const dynamic = 'force-dynamic'

export default function MembershipCancelPage() {
  const { isAr } = useI18n()
  return (
    <div className="bg-[#F8F9FA] py-12">
      <div className="container mx-auto max-w-xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold text-[#1B3A6B]">
            {isAr ? 'تم إلغاء عملية الدفع' : 'Payment cancelled'}
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            {isAr
              ? 'لم تكتمل عملية الاشتراك. يمكنك المحاولة مرة أخرى في أي وقت.'
              : 'Your subscription was not completed. You can try again anytime.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/membership"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
            >
              <Crown className="h-4 w-4" />
              {isAr ? 'العودة للباقات' : 'Back to plans'}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
            >
              {isAr ? 'الرئيسية' : 'Home'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
