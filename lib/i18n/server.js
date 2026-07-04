import { cookies } from 'next/headers'
import { translations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './translations'

/**
 * Server-side helper to read the current language from the `lang` cookie
 * and produce a translation function `t(key)`.
 *
 * Usage in server components:
 *   const { t, lang, isAr } = await getServerT()
 */
export async function getServerT() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('lang')?.value
  const lang = SUPPORTED_LOCALES.includes(raw) ? raw : DEFAULT_LOCALE
  const t = (key) =>
    translations[lang]?.[key] ??
    translations[DEFAULT_LOCALE][key] ??
    key
  return { t, lang, isAr: lang === 'ar', isRTL: lang === 'ar' }
}
