'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Check, X, Crown, Loader2, Sparkles, Star } from 'lucide-react'
import { TIER_META, formatLocaleDate } from '@/lib/membership'
import { useI18n } from '@/lib/i18n/I18nContext'

const ORDER = ['FREE', 'BASIC', 'GOLD', 'PLATINUM']

export default function MembershipPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { t, lang, isAr, isRTL } = useI18n()

  const [me, setMe] = useState(null)
  const [loadingTier, setLoadingTier] = useState(null)
  const [confirm, setConfirm] = useState(null) // tier pending confirmation
  const [toast, setToast] = useState(null)

  // Localised name / tagline / benefits helper
  const meta = (key) => {
    const m = TIER_META[key]
    return {
      ...m,
      name: isAr ? m.nameAr : (m.nameEn || m.nameAr),
      tag: isAr ? m.tagline : (m.taglineEn || m.tagline),
      benefitsList: isAr ? m.benefits : (m.benefitsEn || m.benefits),
      limitsList: isAr ? m.limits : (m.limitsEn || m.limits),
    }
  }

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
        setToast({ type: 'error', msg: data.error || t('mem.toast.error') })
        setLoadingTier(null)
        setConfirm(null)
        setTimeout(() => setToast(null), 4000)
        return
      }

      // ---- LIVE Thawani flow: redirect the buyer to the checkout page ----
      if (data.requiresPayment && data.redirectUrl) {
        setToast({
          type: 'success',
          msg: isAr
            ? 'جارٍ تحويلك إلى بوابة الدفع الآمنة...'
            : 'Redirecting you to the secure payment gateway...',
        })
        // Small delay so the toast is visible, then hard-redirect
        setTimeout(() => {
          window.location.href = data.redirectUrl
        }, 600)
        return
      }

      // ---- Fallback (dev / mock — activates immediately) ----
      if (data.user) setMe(data.user)
      await update()
      const m = meta(confirm)
      const successMsg = isAr
        ? `${t('mem.toast.success.prefix')} ${m.name} ${t('mem.toast.success.suffix')}`
        : `${t('mem.toast.success.prefix')} ${m.name} ${t('mem.toast.success.suffix')}`
      setToast({ type: 'success', msg: successMsg })
    } catch (e) {
      setToast({ type: 'error', msg: t('mem.toast.network') })
    } finally {
      // Only clear loading if we didn't redirect
      setLoadingTier((prev) => (prev === confirm ? null : prev))
      setConfirm(null)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const currentMeta = meta(currentTier)
  const confirmMeta = confirm ? meta(confirm) : null
  const toastSide = isRTL ? 'right-6' : 'left-6'

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12">
      {/* Header */}
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-1.5 text-xs font-medium text-[#8a6f2d]">
          <Sparkles className="h-4 w-4" />
          {t('mem.badge')}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-[#1B3A6B] md:text-5xl">
          {t('mem.title')}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
          {t('mem.subtitle')}
        </p>
      </div>

      {/* Current tier banner */}
      {status === 'authenticated' && (
        <div className="container mx-auto mt-8 px-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1B3A6B]/15 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-[#C9A84C]" />
              <div>
                <div className="text-xs text-gray-500">{t('mem.current.label')}</div>
                <div className="text-sm font-bold text-[#1B3A6B]">
                  {currentMeta.name}
                </div>
              </div>
            </div>
            {me?.membershipExpiry && currentTier !== 'FREE' && (
              <div className={isRTL ? 'text-left' : 'text-right'}>
                <div className="text-xs text-gray-500">{t('mem.expiry.label')}</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatLocaleDate(me.membershipExpiry, lang)}
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
            const m = meta(key)
            const isCurrent = currentTier === key
            const isFree = key === 'FREE'
            const isPopular = !!m.popular
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
                    <Star className={`inline h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} /> {m.tag}
                  </div>
                )}
                {isCurrent && (
                  <div className={`absolute -top-3 ${isRTL ? 'left-4' : 'right-4'} rounded-full bg-[#1B3A6B] px-3 py-1 text-xs font-bold text-white`}>
                    {t('mem.current.badge')}
                  </div>
                )}

                <div className="mb-4">
                  <div className={`text-sm font-semibold ${m.textClass}`}>
                    {m.tag}
                  </div>
                  <h3 className="mt-1 text-2xl font-bold text-[#1B3A6B]">
                    {m.name}
                  </h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-[#1B3A6B]">
                      {m.price}
                    </span>
                    <span className="text-sm text-gray-500">{t('mem.priceUnit')}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {isFree ? t('mem.forever') : t('mem.yearly')}
                  </div>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {m.benefitsList.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-gray-700">{b}</span>
                    </li>
                  ))}
                  {m.limitsList?.map((l) => (
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
                    {t('mem.current.badge')}
                  </button>
                ) : isFree ? (
                  <button
                    onClick={() =>
                      status === 'authenticated'
                        ? setToast({
                            type: 'info',
                            msg: t('mem.toast.freeInfo'),
                          })
                        : router.push('/signup')
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {status === 'authenticated' ? t('mem.free.default') : t('mem.free.signup')}
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
                        {t('mem.subscribing')}
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4" />
                        {t('mem.subscribe')}
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
            {t('mem.discountNote.title')}
          </h4>
          <p className="text-sm text-gray-600">
            {t('mem.discountNote.body')}
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirm && confirmMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A84C]/20">
                <Crown className="h-7 w-7 text-[#C9A84C]" />
              </div>
            </div>
            <h3 className="mb-2 text-center text-xl font-bold text-[#1B3A6B]">
              {t('mem.confirm.title')}
            </h3>
            <p className="mb-4 text-center text-sm text-gray-600">
              {t('mem.confirm.body.prefix')}{' '}
              <span className="font-bold text-[#1B3A6B]">
                {confirmMeta.name}
              </span>{' '}
              {t('mem.confirm.body.amount')}{' '}
              <span className="font-bold text-[#1B3A6B]">
                {confirmMeta.price} {t('mem.priceUnit')}
              </span>{' '}
              {t('mem.confirm.body.suffix')}
            </p>
            <div className="mb-5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-center text-xs text-yellow-800">
              {t('mem.confirm.note')}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('mem.confirm.cancel')}
              </button>
              <button
                onClick={confirmSubscribe}
                className="flex-1 rounded-lg bg-[#1B3A6B] py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
              >
                {t('mem.confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 ${toastSide} z-50 max-w-sm`}>
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
