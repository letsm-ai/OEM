'use client'

import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_HOURS = 24 * 7 // Hide for 1 week after dismiss

export default function InstallPrompt() {
  const { t } = useI18n()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    // Skip if already installed (running standalone) or recently dismissed
    if (typeof window === 'undefined') return

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (isStandalone) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    const hoursSince = (Date.now() - dismissedAt) / (1000 * 60 * 60)
    if (dismissedAt && hoursSince < DISMISS_HOURS) return

    // iOS Safari (no beforeinstallprompt) — show manual hint
    const ua = window.navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    if (isIOS && isSafari) {
      // Wait 30s before nudging iOS users
      const tId = setTimeout(() => setShowIosHint(true), 30_000)
      return () => clearTimeout(tId)
    }

    // Android / Desktop Chrome via beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Nudge after 10s to avoid interrupting page load
      setTimeout(() => setVisible(true), 10_000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setVisible(false)
    setShowIosHint(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
  }

  const install = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      } else {
        dismiss()
      }
    } catch (e) {
      dismiss()
    } finally {
      setDeferredPrompt(null)
    }
  }

  if (!visible && !showIosHint) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:bottom-6 sm:left-6 sm:right-auto">
      <div className="overflow-hidden rounded-2xl border border-[#C9A84C]/30 bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1B3A6B] to-[#152c52] text-white">
            {showIosHint ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#1B3A6B]">
              {t('pwa.install.title')}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
              {showIosHint ? t('pwa.install.ios.hint') : t('pwa.install.body')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!showIosHint && (
                <button
                  onClick={install}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-bold text-[#1B3A6B] transition hover:bg-[#b89440]"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('pwa.install.cta')}
                </button>
              )}
              <button
                onClick={dismiss}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                {showIosHint ? t('pwa.install.ios.dismiss') : t('pwa.install.dismiss')}
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="ms-1 -mt-0.5 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
