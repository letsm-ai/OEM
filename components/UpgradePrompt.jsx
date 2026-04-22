'use client'

import Link from 'next/link'
import { Lock, Crown, ArrowLeft } from 'lucide-react'
import { TIER_META } from '@/lib/membership'

/**
 * Shown when a user tries to access a feature gated by membership tier.
 * Props:
 *  - requiredTier: 'BASIC' | 'GOLD' | 'PLATINUM'
 *  - currentTier: current user tier (or 'FREE')
 *  - featureAr:   e.g. 'فتح متجر بائع'
 *  - descriptionAr: optional longer description
 */
export default function UpgradePrompt({
  requiredTier = 'GOLD',
  currentTier = 'FREE',
  featureAr = 'هذه الميزة',
  descriptionAr,
}) {
  const need = TIER_META[requiredTier]
  const current = TIER_META[currentTier]

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-[#C9A84C]/40 bg-white shadow-sm">
        {/* Top banner */}
        <div className="relative bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] px-8 py-10 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A84C]/20 ring-4 ring-[#C9A84C]/30">
            <Lock className="h-7 w-7 text-[#C9A84C]" />
          </div>
          <h2 className="text-2xl font-bold">
            {featureAr} ميزة حصرية
          </h2>
          <p className="mt-2 text-sm text-gray-200">
            تتطلب هذه الميزة الاشتراك في الباقة{' '}
            <span className="font-bold text-[#C9A84C]">{need.nameAr}</span> أو أعلى
          </p>
        </div>

        <div className="space-y-5 p-8">
          {descriptionAr && (
            <p className="text-center text-sm text-gray-600 leading-relaxed">
              {descriptionAr}
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <div>
              <div className="text-xs text-gray-500">باقتك الحالية</div>
              <div className="mt-0.5 font-semibold text-gray-700">
                {current.nameAr}
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">الباقة المطلوبة</div>
              <div className="mt-0.5 flex items-center gap-1 font-bold text-[#8a6f2d]">
                <Crown className="h-4 w-4 text-[#C9A84C]" />
                {need.nameAr}
              </div>
            </div>
          </div>

          <Link
            href="/membership"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] py-3 text-center text-sm font-semibold text-[#1B3A6B] transition hover:bg-[#b89440]"
          >
            <Crown className="h-4 w-4" />
            رقِّ عضويتك الآن
          </Link>

          <p className="text-center text-xs text-gray-500">
            يمكنك الترقية أو التغيير في أي وقت
          </p>
        </div>
      </div>
    </div>
  )
}
