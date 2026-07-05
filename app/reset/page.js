'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, CheckCircle2, AlertTriangle, Home, Trash2 } from 'lucide-react'

/**
 * /reset — Emergency page to clear Service Worker + all caches.
 * Use when users report stale/broken assets caused by aggressive PWA caching.
 * This page itself must NEVER be cached (see next.config.js headers).
 */
export default function ResetPage() {
  const [step, setStep] = useState('idle') // idle | running | done | error
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  const add = (msg) => setLog((l) => [...l, msg])

  const runReset = async () => {
    setStep('running')
    setLog([])
    setError('')
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        add(`عُثر على ${regs.length} Service Worker مسجّل`)
        for (const r of regs) {
          const ok = await r.unregister()
          add(ok ? `✓ تم إلغاء تسجيل ${r.scope}` : `✗ فشل إلغاء ${r.scope}`)
        }
      } else {
        add('المتصفح لا يدعم Service Workers')
      }

      // 2. Delete all Cache Storage entries
      if ('caches' in window) {
        const names = await caches.keys()
        add(`عُثر على ${names.length} كاش`)
        await Promise.all(names.map(async (n) => {
          const ok = await caches.delete(n)
          add(ok ? `✓ حُذف الكاش: ${n}` : `✗ فشل حذف ${n}`)
        }))
      } else {
        add('المتصفح لا يدعم Cache Storage')
      }

      // 3. Clear localStorage & sessionStorage (skip lang preference)
      try {
        const langPref = localStorage.getItem('lang')
        localStorage.clear()
        if (langPref) localStorage.setItem('lang', langPref)
        sessionStorage.clear()
        add('✓ تم مسح localStorage / sessionStorage')
      } catch (e) {
        add('⚠️ تعذّر مسح التخزين المحلي')
      }

      add('✅ اكتمل التنظيف!')
      setStep('done')
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع')
      setStep('error')
    }
  }

  const hardReload = () => {
    // Force reload bypassing cache
    window.location.href = '/?_r=' + Date.now()
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1B3A6B]">إعادة تعيين الموقع</h1>
              <p className="text-xs text-gray-500">
                لحل مشاكل عرض الصور أو الأصول القديمة
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-3.5 w-3.5" />
              متى تستخدم هذه الأداة؟
            </div>
            <ul className="list-disc space-y-0.5 pr-5">
              <li>الشعار أو الصور لا تظهر</li>
              <li>ترى نسخة قديمة رغم التحديث</li>
              <li>الأزرار أو الأيقونات مفقودة</li>
              <li>الموقع يتصرّف بشكل غير طبيعي</li>
            </ul>
          </div>

          {step === 'idle' && (
            <>
              <p className="mb-4 text-sm text-gray-600">
                ستقوم هذه الأداة بمسح كل الملفات المخزّنة مؤقتاً وإعادة تسجيل التطبيق. لن يتأثر حسابك أو بياناتك.
              </p>
              <button
                onClick={runReset}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B3A6B] py-3 text-sm font-bold text-white transition hover:bg-[#152c52]"
              >
                <Trash2 className="h-4 w-4" />
                امسح الكاش وأعد التسجيل
              </button>
            </>
          )}

          {step === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1B3A6B]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                جاري التنظيف...
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] font-mono text-gray-700">
                {log.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap">{l}</div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                تم التنظيف بنجاح!
              </div>
              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] font-mono text-gray-700">
                {log.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
              <p className="mb-4 text-sm text-gray-600">
                الخطوة التالية: <b>أعِد تحميل الصفحة</b> لتفعيل النسخة الجديدة نظيفة.
              </p>
              <button
                onClick={hardReload}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9A84C] py-3 text-sm font-bold text-[#1B3A6B] transition hover:bg-[#b89440]"
              >
                <Home className="h-4 w-4" />
                عد إلى الصفحة الرئيسية
              </button>
            </>
          )}

          {step === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4" />
                فشل التنظيف
              </div>
              <p className="text-xs">{error}</p>
              <p className="mt-2 text-xs">
                جرّب مسح بيانات الموقع يدوياً من إعدادات المتصفح.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          مشكلة مستمرة؟ تواصل معنا:{' '}
          <a href="mailto:support@omanimajles.com" className="text-[#1B3A6B] underline">
            support@omanimajles.com
          </a>
        </div>
      </div>
    </div>
  )
}
