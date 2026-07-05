'use client'

import { Bell, BellOff, Loader2 } from 'lucide-react'
import usePushSubscription from '@/lib/hooks/usePushSubscription'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useState } from 'react'

export default function PushToggleButton({ variant = 'default' }) {
  const { t, lang } = useI18n()
  const { supported, permission, subscribed, busy, error, subscribe, unsubscribe } = usePushSubscription()
  const [flash, setFlash] = useState(null)

  if (!supported) return null

  const showFlash = (msg, type = 'info') => {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 3500)
  }

  const onToggle = async () => {
    if (subscribed) {
      const ok = await unsubscribe()
      if (ok) showFlash(t('push.disabled'), 'info')
    } else {
      const ok = await subscribe(lang)
      if (ok) {
        showFlash(t('push.enabled'), 'success')
      } else {
        const key = error === 'denied'
          ? 'push.error.denied'
          : error === 'unsupported'
          ? 'push.error.unsupported'
          : 'push.error.generic'
        showFlash(t(key), 'error')
      }
    }
  }

  const isCompact = variant === 'compact'
  const isOn = subscribed && permission === 'granted'

  return (
    <div className={isCompact ? '' : 'space-y-2'}>
      {!isCompact && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isOn ? 'bg-green-100 text-green-700' : 'bg-[#C9A84C]/10 text-[#C9A84C]'}`}>
            {isOn ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-[#1B3A6B]">
              {t('push.enable.title')}
            </div>
            <div className="mt-0.5 text-xs text-gray-600">
              {isOn ? t('push.status.on') : t('push.enable.subtitle')}
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={busy || permission === 'denied'}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              isOn
                ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                : 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
            }`}
          >
            {busy ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('push.enabling')}</>
            ) : isOn ? (
              <>{t('push.disable.cta')}</>
            ) : (
              <><Bell className="h-3.5 w-3.5" /> {t('push.enable.cta')}</>
            )}
          </button>
        </div>
      )}

      {isCompact && (
        <button
          onClick={onToggle}
          disabled={busy || permission === 'denied'}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            isOn
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title={isOn ? t('push.status.on') : t('push.enable.cta')}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isOn ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          <span>{isOn ? t('push.status.on') : t('push.enable.cta')}</span>
        </button>
      )}

      {permission === 'denied' && !isCompact && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {t('push.error.denied')}
        </div>
      )}

      {flash && !isCompact && (
        <div className={`rounded-md px-3 py-2 text-xs font-medium ${
          flash.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : flash.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-gray-50 border border-gray-200 text-gray-700'
        }`}>
          {flash.msg}
        </div>
      )}
    </div>
  )
}
