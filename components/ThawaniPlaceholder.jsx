import { CreditCard } from 'lucide-react'

/**
 * Thawani Pay placeholder UI.
 * NOTE: Live Thawani Pay integration is currently in UAT (sandbox).
 * TODO: Replace with Thawani Pay API key and endpoint when production keys are provided.
 *       The actual integration code lives in /app/lib/thawani.js (UAT mode).
 *       To switch to production:
 *         1. Add THAWANI_PUBLIC_KEY and THAWANI_SECRET_KEY (production) in /app/.env
 *         2. Set THAWANI_BASE_URL to https://checkout.thawani.om/api/v1
 *         3. Restart the Next.js service.
 */
export default function ThawaniPlaceholder({ amount = 0, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#1B3A6B] bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:from-[#152c52] hover:to-[#0f2348] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        دفع عبر Thawani Pay
      </span>
      <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs">
        {amount > 0 ? `${amount.toFixed(2)} ر.ع` : 'UAT'}
      </span>
    </button>
  )
}
