'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/translations'

const I18nContext = createContext(null)

function readCookieLocale() {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const m = document.cookie.match(/(?:^|; )lang=([^;]+)/)
  const v = m ? decodeURIComponent(m[1]) : ''
  return SUPPORTED_LOCALES.includes(v) ? v : DEFAULT_LOCALE
}

function writeCookieLocale(lang) {
  if (typeof document === 'undefined') return
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `lang=${encodeURIComponent(lang)}; path=/; max-age=${oneYear}; samesite=lax`
}

export function I18nProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [lang, setLangState] = useState(initialLocale)

  // Sync from cookie on first mount (in case SSR default differs from client cookie)
  useEffect(() => {
    const c = readCookieLocale()
    if (c !== lang) setLangState(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const setLang = useCallback((next) => {
    if (!SUPPORTED_LOCALES.includes(next)) return
    writeCookieLocale(next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (key) => translations[lang]?.[key] || translations[DEFAULT_LOCALE][key] || key,
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isAr: lang === 'ar', isRTL: lang === 'ar' }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Safe fallback so partial usage doesn't throw during SSR/edge cases
    return {
      lang: DEFAULT_LOCALE,
      setLang: () => {},
      t: (k) => translations[DEFAULT_LOCALE][k] || k,
      isAr: DEFAULT_LOCALE === 'ar',
      isRTL: DEFAULT_LOCALE === 'ar',
    }
  }
  return ctx
}
