'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Crown,
  Home,
  LayoutDashboard,
} from 'lucide-react'
import { TIER_META } from '@/lib/membership'
import { useI18n } from '@/lib/i18n/I18nContext'

export default function MembershipSuccessClient() {
  const sp = useSearchParams()
  const sessionId = sp.get('session_id')
  const membershipId = sp.get('mid')
  const { update } = useSession()
  const { isAr } = useI18n()

  const [state, setState] = useState({
    loading: true,
    paid: false,
    error: '',
    membership: null,
  })

  useEffect(() => {
    let cancelled = false
    const verify = async () => {
      try {
        const res = await fetch('/api/membership/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, membershipId }),
        })
        const d = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setState({
            loading: false,
            paid: false,
            error: d.error || (isAr ? 'فشل التحقق من الدفع' : 'Payment verification failed'),
            membership: null,
          })
          return
        }
        const paid = !!(d.success && (d.membership?.paymentStatus === 'PAID'))
        setState({
          loading: false,
          paid,
          error: paid ? '' : d.message || '',
          membership: d.membership || null,
        })
        if (paid) {
          // Refresh NextAuth token so header/UI reflect the new tier
          try { await update() } catch (_) { /* ignore refresh errors */ }
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            paid: false,
            error: isAr ? 'تعذّر الاتصال بالخادم' : 'Could not reach the server',
            membership: null,
          })
        }
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [sessionId, membershipId, isAr, update])

  if (state.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#1B3A6B]" />
          <div className="text-sm font-semibold text-gray-700">
            {isAr ? 'جارٍ التحقق من عملية الدفع...' : 'Verifying your payment...'}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {isAr ? 'يرجى عدم إغلاق الصفحة' : 'Please do not close this page'}
          </div>
        </div>
      </div>
    )
  }

  if (!state.paid) {
    return (
      <div className="bg-[#F8F9FA] py-12">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
            <h1 className="mb-2 text-xl font-extrabold text-amber-800">
              {isAr ? 'لم يكتمل الدفع بعد' : 'Payment not completed'}
            </h1>
            <p className="mb-5 text-sm text-amber-700">
              {state.error ||
                (isAr
                  ? 'الدفع قيد المعالجة أو تم إلغاؤه. إذا قمت بالدفع بالفعل، حاول تحديث الصفحة خلال لحظات.'
                  : 'Your payment is still processing or was cancelled. If you already paid, refresh in a moment.')}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                {isAr ? 'تحديث الصفحة' : 'Refresh page'}
              </button>
              <Link
                href="/membership"
                className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                {isAr ? 'العودة للباقات' : 'Back to plans'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const m = state.membership
  const meta = m?.tier ? TIER_META[m.tier] : null
  const tierName = meta ? (isAr ? meta.nameAr : (meta.nameEn || meta.nameAr)) : m?.tier
  const expiryLabel = m?.endDate
    ? new Date(m.endDate).toLocaleDateString(isAr ? 'ar-OM' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <div className="bg-[#F8F9FA] py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B]">
              {isAr ? 'تم تفعيل عضويتك بنجاح! 🎉' : 'Your membership is active! 🎉'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {isAr
                ? 'شكراً لانضمامك إلى مجلس رواد الأعمال العُمانيين'
                : 'Thank you for joining the Omani Entrepreneurs Council'}
            </p>
          </div>

          <div className="space-y-3 rounded-xl bg-[#F8F9FA] p-4 text-sm">
            <Row
              label={isAr ? 'الباقة' : 'Plan'}
              value={
                <span className="inline-flex items-center gap-2 font-bold text-[#1B3A6B]">
                  <Crown className="h-4 w-4 text-[#C9A84C]" />
                  {tierName}
                </span>
              }
            />
            {expiryLabel && (
              <Row label={isAr ? 'صالحة حتى' : 'Valid until'} value={expiryLabel} />
            )}
            {meta?.price ? (
              <Row
                label={isAr ? 'المبلغ المدفوع' : 'Amount paid'}
                value={`${meta.price.toFixed(3)} ${isAr ? 'ر.ع' : 'OMR'}`}
                bold
              />
            ) : null}
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
            {isAr
              ? '📧 تم إرسال تأكيد الاشتراك إلى بريدك الإلكتروني. استمتع بجميع مزايا باقتك الآن!'
              : '📧 A confirmation email has been sent. Enjoy all your plan benefits now!'}
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
            >
              <LayoutDashboard className="h-4 w-4" />
              {isAr ? 'الذهاب للوحة التحكم' : 'Go to dashboard'}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
            >
              <Home className="h-4 w-4" />
              {isAr ? 'الرئيسية' : 'Home'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'text-lg font-extrabold text-[#1B3A6B]' : 'font-semibold text-gray-700'}>
        {value}
      </span>
    </div>
  )
}
