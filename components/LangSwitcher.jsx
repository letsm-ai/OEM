'use client'

import { useI18n } from '@/lib/i18n/I18nContext'
import { Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LangSwitcher({ variant = 'default' }) {
  const { lang, setLang } = useI18n()
  const router = useRouter()
  const next = lang === 'ar' ? 'en' : 'ar'
  const label = next === 'en' ? 'English' : 'العربية'

  const baseCls = 'inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition'
  const styles =
    variant === 'compact'
      ? 'px-2 py-1 text-[#1B3A6B] hover:bg-[#F8F9FA]'
      : 'border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50'

  const onSwitch = () => {
    setLang(next)
    // Refresh so server components (which read the `lang` cookie) re-render.
    router.refresh()
  }

  return (
    <button
      onClick={onSwitch}
      aria-label={`Switch language to ${label}`}
      className={`${baseCls} ${styles}`}
      type="button"
    >
      <Globe className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}
