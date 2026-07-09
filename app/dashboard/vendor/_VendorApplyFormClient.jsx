'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, AlertTriangle } from 'lucide-react'
import VendorAgreementGate from '@/components/VendorAgreementGate'

export default function VendorApplyFormClient() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreementAccepted, setAgreementAccepted] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!businessName.trim()) return setError('اسم المتجر مطلوب')
    setLoading(true)
    const res = await fetch('/api/vendor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        businessDescription,
        phone,
        agreementAccepted: true, // gate is enforced before this render
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(data.error || 'تعذّر إرسال الطلب')
    router.refresh()
  }

  // Stage 1: mandatory vendor contract acceptance
  if (!agreementAccepted) {
    return (
      <div className="mt-4">
        <VendorAgreementGate onAccept={() => setAgreementAccepted(true)} />
      </div>
    )
  }

  // Stage 2: business details form
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
          ✓
        </span>
        تمّت الموافقة على عقد البائع — تابع بإدخال بيانات المتجر
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">اسم المتجر/النشاط *</label>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          placeholder="مثال: عسل عُمان"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">وصف النشاط</label>
        <textarea
          rows={3}
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">رقم التواصل</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B3A6B]"
          placeholder="+968 9XXX XXXX"
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        إرسال الطلب
      </button>
    </form>
  )
}
