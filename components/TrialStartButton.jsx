'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Gift, Loader2, Crown, CheckCircle2 } from 'lucide-react'

const TIER_LABELS = { BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }

/**
 * Client-side button for starting the one-time free trial.
 * If `allowedTier` is set (admin locked the trial to a tier) → single button.
 * Otherwise → let the user pick a tier via 3 buttons.
 */
export default function TrialStartButton({ allowedTier = '', durationDays = 30 }) {
  const router = useRouter()
  const { update } = useSession()
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const start = async (tier) => {
    setLoading(tier)
    setError('')
    try {
      const res = await fetch('/api/membership/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'تعذّر بدء التجربة')
        return
      }
      setDone({ tier: data.trial?.tier || tier, end: data.trial?.end })
      try { await update() } catch (_) { /* ignore session refresh error */ }
      // Give the toast a moment then refresh so the dashboard picks up the trial
      setTimeout(() => router.refresh(), 1200)
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading('')
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <div>
          <div className="font-bold">تم تفعيل تجربة {TIER_LABELS[done.tier] || done.tier} بنجاح!</div>
          <div className="text-xs opacity-80">
            صالحة لمدة {durationDays} يوم — استمتع بكل المزايا 🎉
          </div>
        </div>
      </div>
    )
  }

  const tiers = allowedTier
    ? [allowedTier]
    : ['BASIC', 'GOLD', 'PLATINUM']

  return (
    <div>
      {error && (
        <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {tiers.map((tier) => (
          <button
            key={tier}
            onClick={() => start(tier)}
            disabled={!!loading}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
              tier === 'GOLD'
                ? 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
                : tier === 'PLATINUM'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading === tier ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              tier === 'GOLD' || tier === 'PLATINUM' ? (
                <Crown className="h-4 w-4" />
              ) : (
                <Gift className="h-4 w-4" />
              )
            )}
            جرّب {TIER_LABELS[tier]} مجاناً
          </button>
        ))}
      </div>
    </div>
  )
}
