'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, ScrollText, ShoppingBag, ChevronDown, Sparkles } from 'lucide-react'
import { VENDOR_AGREEMENT_AR, VENDOR_AGREEMENT_VERSION } from '@/lib/vendor-agreement'

/**
 * Mandatory vendor onboarding contract screen shown before the become-vendor
 * application form. Requires scroll-through + checkbox before "أوافق وأتابع"
 * becomes clickable. Identical pattern to ExpertAgreementGate.
 */
export default function VendorAgreementGate({ onAccept }) {
  const [checked, setChecked] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
      if (remaining < 40 && !scrolledToEnd) setScrolledToEnd(true)
    }
    el.addEventListener('scroll', check, { passive: true })
    if (el.scrollHeight <= el.clientHeight + 10) setScrolledToEnd(true)
    return () => el.removeEventListener('scroll', check)
  }, [scrolledToEnd])

  const canAccept = checked && scrolledToEnd
  const a = VENDOR_AGREEMENT_AR

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
            <ScrollText className="h-3 w-3" /> الخطوة 1 من 2 — عقد البائع
          </div>
          <h1 className="text-xl font-extrabold text-[#1B3A6B]">{a.title}</h1>
          <p className="mt-0.5 text-xs text-gray-500">{a.subtitle}</p>
        </div>
      </div>

      <p className="text-sm leading-7 text-gray-700">{a.intro}</p>

      {/* Scrollable contract */}
      <div
        ref={scrollRef}
        className="relative h-[420px] overflow-y-auto rounded-xl border border-gray-200 bg-[#FAFAFA] p-5 leading-8 text-gray-800"
      >
        {a.sections.map((sec, i) => (
          <section key={i} className="mb-5">
            <h3
              className={`mb-2 text-sm font-extrabold ${
                sec.important ? 'text-red-600' : 'text-[#1B3A6B]'
              }`}
            >
              {sec.title}
              {sec.important && (
                <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  إلزامي
                </span>
              )}
            </h3>
            {sec.body && <p className="mb-2 text-[13px] text-gray-700">{sec.body}</p>}
            {sec.items && (
              <ul className="space-y-1.5 text-[13px]">
                {sec.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-900">
          {a.acceptance}
        </div>
        <div className="mt-3 text-[10px] text-gray-400">
          نسخة العقد: {VENDOR_AGREEMENT_VERSION}
        </div>
      </div>

      {!scrolledToEnd && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 py-2 text-xs font-semibold text-amber-800">
          <ChevronDown className="h-4 w-4 animate-bounce" />
          قم بالتمرير حتى نهاية العقد لقراءة كامل البنود
        </div>
      )}

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
          !scrolledToEnd
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
            : checked
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-gray-300 bg-white hover:border-[#1B3A6B]'
        }`}
      >
        <input
          type="checkbox"
          disabled={!scrolledToEnd}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
        />
        <span className="text-sm font-semibold text-gray-800">
          قرأت جميع البنود أعلاه وأوافق عليها بشكل كامل وغير مشروط، وأتحمّل المسؤولية القانونية عن الالتزام بها وعن جميع منتجاتي المعروضة.
        </span>
      </label>

      <button
        type="button"
        disabled={!canAccept}
        onClick={onAccept}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold transition ${
          canAccept
            ? 'bg-gradient-to-l from-emerald-600 to-emerald-700 text-white shadow-md hover:shadow-lg'
            : 'cursor-not-allowed bg-gray-200 text-gray-500'
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
        {canAccept ? 'أوافق وأتابع لفتح المتجر' : 'يجب قراءة العقد والموافقة أولاً'}
        {canAccept && <Sparkles className="h-3 w-3" />}
      </button>
    </div>
  )
}
