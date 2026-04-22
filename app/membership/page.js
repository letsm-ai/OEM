'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Check, X, Crown, Loader2, Sparkles, Star } from 'lucide-react'
import { TIER_META, formatArabicDate } from '@/lib/membership'

const ORDER = ['FREE', 'BASIC', 'GOLD', 'PLATINUM']

export default function MembershipPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [me, setMe] = useState(null)
  const [loadingTier, setLoadingTier] = useState(null)
  const [confirm, setConfirm] = useState(null) // tier pending confirmation
  const [toast, setToast] = useState(null)

  // Fetch fresh user info to get membershipExpiry
  useEffect(() => {
    async function loadMe() {
      if (status !== 'authenticated') return
      const res = await fetch('/api/me')
      if (res.ok) {
        const u = await res.json()
        setMe(u)
      }
    }
    loadMe()
  }, [status])

  const currentTier = me?.membershipTier || session?.user?.membershipTier || 'FREE'

  const onSubscribe = async (tier) => {
    if (status !== 'authenticated') {
      router.push('/login?callbackUrl=/membership')
      return
    }
    setConfirm(tier)
  }

  const confirmSubscribe = async () => {
    if (!confirm) return
    setLoadingTier(confirm)
    try {
      const res = await fetch('/api/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: confirm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ type: 'error', msg: data.error || 'تعذر الاشتراك' })
      } else {
        setMe(data.user)
        // Refresh NextAuth token so session.membershipTier updates too
        await update()
        setToast({
          type: 'success',
          msg: `تم تفعيل باقة ${TIER_META[confirm].nameAr} بنجاح!`,
        })
      }
    } catch (e) {
      setToast({ type: 'error', msg: 'خطأ في الشبكة' })
    } finally {
      setLoadingTier(null)
      setConfirm(null)
      setTimeout(() => setToast(null), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      {/* Header */}
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-1.5 text-xs font-medium text-[#8a6f2d]">
          <Sparkles className="h-4 w-4" />
          باقات العضوية
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-[#1B3A6B] md:text-5xl">
          اختر الباقة المناسبة لأعمالك
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
          ادفع أعمالك للأمام مع مزايا متدرجة تلبي احتياجاتك. جميع الأسعار سنوية بالريال العماني.
        </p>
      </div>

      {/* Current tier banner */}
      {status === 'authenticated' && (
        <div className="container mx-auto mt-8 px-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1B3A6B]/15 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-[#C9A84C]" />
              <div>
                <div className="text-xs text-gray-500">باقتك الحالية</div>
                <div className="text-sm font-bold text-[#1B3A6B]">
                  {TIER_META[currentTier].nameAr}
                </div>
              </div>
            </div>
            {me?.membershipExpiry && currentTier !== 'FREE' && (
              <div className="text-left">
                <div className="text-xs text-gray-500">تاريخ الانتهاء</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatArabicDate(me.membershipExpiry)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing grid */}
      <div className="container mx-auto mt-10 px-4">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {ORDER.map((key) => {
            const t = TIER_META[key]
            const isCurrent = currentTier === key
            const isFree = key === 'FREE'
            const isPopular = !!t.popular
            return (
              <div
                key={key}
                className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 transition ${
                  isPopular
                    ? 'border-[#C9A84C] shadow-xl md:scale-[1.02]'
                    : 'border-gray-200 shadow-sm hover:border-gray-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full bg-[#C9A84C] px-3 py-1 text-xs font-bold text-[#1B3A6B]">
                    <Star className="mr-1 inline h-3 w-3" /> {t.tagline}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-4 rounded-full bg-[#1B3A6B] px-3 py-1 text-xs font-bold text-white">
                    باقتك الحالية
                  </div>
                )}

                <div className="mb-4">
                  <div className={`text-sm font-semibold ${t.textClass}`}>
                    {t.tagline}
                  </div>
                  <h3 className="mt-1 text-2xl font-bold text-[#1B3A6B]">
                    {t.nameAr}
                  </h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-[#1B3A6B]">
                      {t.price}
                    </span>
                    <span className="text-sm text-gray-500">ر.ع</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {isFree ? 'مجاني إلى الأبد' : 'سنوياً'}
                  </div>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {t.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-gray-700">{b}</span>
                    </li>
                  ))}
                  {t.limits?.map((l) => (
                    <li
                      key={l}
                      className="flex items-start gap-2 text-sm text-gray-400"
                    >
                      <X className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="line-through">{l}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-500"
                  >
                    باقتك الحالية
                  </button>
                ) : isFree ? (
                  <button
                    onClick={() =>
                      status === 'authenticated'
                        ? setToast({
                            type: 'info',
                            msg: 'الباقة المجانية متاحة افتراضياً',
                          })
                        : router.push('/signup')
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {status === 'authenticated' ? 'افتراضي' : 'انشئ حساب مجاني'}
                  </button>
                ) : (
                  <button
                    onClick={() => onSubscribe(key)}
                    disabled={loadingTier === key}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                      isPopular
                        ? 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
                        : 'bg-[#1B3A6B] text-white hover:bg-[#152c52]'
                    }`}
                  >
                    {loadingTier === key ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري...
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4" />
                        اشترك الآن
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Comparison Note */}
      <div className="container mx-auto mt-12 px-4">
        <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h4 className="mb-2 font-bold text-[#1B3A6B]">
            خصومات الأعضاء تطبق تلقائياً
          </h4>
          <p className="text-sm text-gray-600">
            عند الشراء من المتجر أو حجز الاستشارات، سيتم خصم نسبة باقتك مباشرة من السعر النهائي.
            تنتهي باقات العضوية بعد سنة واحدة ويمكنك تجديدها أو تغييرها في أي وقت.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A84C]/20">
                <Crown className="h-7 w-7 text-[#C9A84C]" />
              </div>
            </div>
            <h3 className="mb-2 text-center text-xl font-bold text-[#1B3A6B]">
              تأكيد الاشتراك
            </h3>
            <p className="mb-4 text-center text-sm text-gray-600">
              الاشتراك في باقة{' '}
              <span className="font-bold text-[#1B3A6B]">
                {TIER_META[confirm].nameAr}
              </span>{' '}
              بمبلغ{' '}
              <span className="font-bold text-[#1B3A6B]">
                {TIER_META[confirm].price} ر.ع
              </span>{' '}
              سنوياً؟
            </p>
            <div className="mb-5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-center text-xs text-yellow-800">
              ملاحظة: الدفع تجريبي في هذه المرحلة ولن يتم خصم أي مبلغ فعلي.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmSubscribe}
                className="flex-1 rounded-lg bg-[#1B3A6B] py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
              >
                تأكيد الاشتراك
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
          <div
            className={`rounded-lg px-5 py-3 text-sm font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-[#1B3A6B] text-white'
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}
