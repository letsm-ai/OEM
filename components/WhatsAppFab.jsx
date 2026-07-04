'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

const RAW = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const WA_NUMBER = RAW.replace(/[^0-9]/g, '')
const DEFAULT_MSG = encodeURIComponent(
  'مرحباً! أرغب في الاستفسار عن خدمات مجلس رواد الأعمال العماني'
)

export default function WhatsAppFab() {
  const [open, setOpen] = useState(false)
  if (!WA_NUMBER) return null
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${DEFAULT_MSG}`

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
      {/* Speech bubble */}
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-2 max-w-xs rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-800">دعم المجلس</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-600">
            مرحباً 👋 كيف يمكننا مساعدتك اليوم؟
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-[#25D366] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#20BC5A]"
          >
            ابدأ المحادثة على واتساب
          </a>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="واتساب"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-25" />
        <MessageCircle className="relative h-7 w-7" />
      </button>
    </div>
  )
}
