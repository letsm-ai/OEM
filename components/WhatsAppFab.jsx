'use client'

import { MessageCircle } from 'lucide-react'

const RAW = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const WA_NUMBER = RAW.replace(/[^0-9]/g, '')
const DEFAULT_MSG = encodeURIComponent(
  'مرحباً! أرغب في الاستفسار عن خدمات مجلس رواد الأعمال العماني'
)

/**
 * Floating WhatsApp button.
 * Uses api.whatsapp.com/send which reliably deep-links to the WhatsApp app
 * on iOS + Android and falls back to WhatsApp Web on desktop.
 */
export default function WhatsAppFab() {
  if (!WA_NUMBER) return null
  const waUrl = `https://api.whatsapp.com/send?phone=${WA_NUMBER}&text=${DEFAULT_MSG}`

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      title="تواصل معنا عبر واتساب"
      className="group fixed bottom-4 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-25" />
      <MessageCircle className="h-7 w-7" />
    </a>
  )
}
