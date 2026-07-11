'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react'

export default function CleanupClient() {
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/cleanup/scan')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SCAN_FAILED')
      setScan(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const executeCleanup = async () => {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/cleanup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE-TEST-DATA' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'DELETE_FAILED')
      setResult(data)
      setConfirmOpen(false)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            تنظيف بيانات الاختبار
          </h1>
          <p className="text-sm text-gray-500">
            اكتشف واحذف الحسابات التجريبية مع كل بياناتها المرتبطة.
          </p>
        </div>
      </div>

      <Alert className="mb-4 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertTitle className="text-amber-900">ما الذي سيذف ؏</AlertTitle>
        <AlertDescription className="text-amber-800 text-xs leading-relaxed">
          كل مستخدم إيميله يطابق أحد الأنماط التالية (محجوزة للاختبار في RFC-2606):
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">@x.com</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">@test.*</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">@example.*</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">*.test</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">*.example.*</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">@localhost</code>،
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono">@resend-test.*</code>
          <br />
          يتم حذف المستخدم + منتجاته + طلباته + شركاته + اشتراكاته + حجوزاته + تقييماته + سلته + مفضلته.
          العملية غير قابلة للتراجع.
        </AlertDescription>
      </Alert>

      {result && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-900">تم الحذف بنجاح</AlertTitle>
          <AlertDescription className="text-emerald-800 text-xs">
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
              {Object.entries(result.deleted || {}).map(([k, v]) => (
                v > 0 && (
                  <div key={k} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-gray-600">{k}</span>
                    <span className="font-bold">{v}</span>
                  </div>
                )
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900">خطأ</AlertTitle>
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ما سيتم حذفه</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ الفحص...
            </div>
          ) : scan ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['المستخدمون', scan.totals.users, 'text-red-600'],
                  ['المنتجات', scan.totals.products, 'text-orange-600'],
                  ['الطلبات', scan.totals.orders, 'text-amber-600'],
                  ['الشركات', scan.totals.companies, 'text-cyan-700'],
                  ['الخبراء', scan.totals.experts, 'text-indigo-600'],
                  ['الاشتراكات', scan.totals.memberships, 'text-emerald-600'],
                  ['الحجوزات', scan.totals.appointments, 'text-purple-600'],
                  ['طلبات البائع', scan.totals.vendorApplications, 'text-pink-600'],
                ].map(([label, val, color]) => (
                  <div key={label} className="rounded-lg border bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500">{label}</div>
                    <div className={`mt-1 text-2xl font-extrabold ${color}`}>{val}</div>
                  </div>
                ))}
              </div>

              {scan.users.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-right text-xs text-gray-500">
                        <th className="px-3 py-2">الإيميل</th>
                        <th className="px-3 py-2">الاسم</th>
                        <th className="px-3 py-2">الدور</th>
                        <th className="px-3 py-2">الباقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.users.slice(0, 100).map((u) => (
                        <tr key={u.id} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-[11px]">{u.email}</td>
                          <td className="px-3 py-2 text-xs">{u.name || '—'}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-[10px]">{u.tier}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scan.users.length > 100 && (
                    <div className="bg-gray-50 p-2 text-center text-[11px] text-gray-500">
                      ... و {scan.users.length - 100} مستخدم أخرين غير معروضين
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-lg border bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-2 font-semibold text-emerald-900">
                    لا توجد بيانات تجريبية للحذف
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    قاعدة البيانات نظيفة — لا يوجد أي مستخدم بإيميل تجريبي.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {scan?.totals?.users > 0 && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setConfirmOpen(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            حذف كل البيانات التجريبية ({scan.totals.users} مستخدم)
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription className="text-red-700">
              أنت على وشك حذف{' '}
              <strong>{scan?.totals?.users || 0} مستخدم</strong>{' '}
              مع كل بياناتهم المرتبطة (منتجات، طلبات، شركات، اشتراكات...).
              العملية غير قابلة للتراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={executeCleanup}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="ml-2 h-4 w-4" />
                  نعم، احذف الآن
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
