'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Send,
  Users,
  Eye,
  Loader2,
  Mail,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  FileText,
  Sparkles,
  Tag,
  Clock,
  Bell,
  Calendar,
  Heart,
  Save,
  Trash2,
  Plus,
  BookMarked,
} from 'lucide-react'
import { BROADCAST_TEMPLATES, BROADCAST_TEMPLATE_CATEGORIES } from '@/lib/broadcast-templates'

const TEMPLATE_ICONS = { Sparkles, Tag, Clock, Bell, Calendar, Heart }

const TIERS = [
  { key: 'FREE', label: 'مجاني', color: 'bg-gray-100 text-gray-700' },
  { key: 'BASIC', label: 'أساسي', color: 'bg-blue-100 text-blue-700' },
  { key: 'GOLD', label: 'ذهبي', color: 'bg-amber-100 text-amber-700' },
  { key: 'PLATINUM', label: 'بلاتيني', color: 'bg-purple-100 text-purple-700' },
]

const ROLES = [
  { key: 'VENDOR', label: 'التجار', color: 'bg-pink-100 text-pink-700' },
  { key: 'EXPERT', label: 'الخبراء', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'MEMBER', label: 'الأعضاء العاديون', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'ADMIN', label: 'المسؤولون', color: 'bg-slate-200 text-slate-700' },
]

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('ar', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(d).slice(0, 16)
  }
}

function StatusBadge({ status }) {
  const map = {
    PENDING: { label: 'قيد الانتظار', className: 'bg-gray-100 text-gray-700' },
    SENDING: { label: 'جارٍ الإرسال', className: 'bg-blue-100 text-blue-700' },
    COMPLETED: { label: 'مكتمل', className: 'bg-emerald-100 text-emerald-700' },
    FAILED: { label: 'فشل', className: 'bg-red-100 text-red-700' },
  }
  const s = map[status] || map.PENDING
  return <Badge className={s.className + ' font-semibold'}>{s.label}</Badge>
}

export default function BroadcastClient() {
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [tiers, setTiers] = useState([])
  const [roles, setRoles] = useState([])
  const [activeOnly, setActiveOnly] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)

  const applyTemplate = (tpl) => {
    setSelectedTemplateId(tpl.id)
    setSubject(tpl.subject)
    setHtmlBody(tpl.htmlBody)
  }
  const clearTemplate = () => {
    setSelectedTemplateId(null)
    setSubject('')
    setHtmlBody('')
  }

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [customTemplates, setCustomTemplates] = useState([])
  const [customLoading, setCustomLoading] = useState(true)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveCategory, setSaveCategory] = useState('update')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadCustomTemplates = useCallback(async () => {
    setCustomLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast/templates')
      const data = await res.json()
      setCustomTemplates(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      console.error(e)
    } finally {
      setCustomLoading(false)
    }
  }, [])

  const saveAsTemplate = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/admin/broadcast/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          description: saveDescription,
          category: saveCategory,
          subject,
          htmlBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SAVE_FAILED')
      setSaveOpen(false)
      setSaveName('')
      setSaveDescription('')
      setSaveCategory('update')
      loadCustomTemplates()
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteCustomTemplate = async (id) => {
    if (!confirm('هل تريد حذف هذا القالب المخصّص؟')) return
    try {
      const res = await fetch('/api/admin/broadcast/templates/' + id, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('DELETE_FAILED')
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null)
      }
      loadCustomTemplates()
    } catch (e) {
      alert('تعذّر الحذف: ' + e.message)
    }
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast/history?limit=50')
      const data = await res.json()
      setHistory(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      console.error(e)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
    loadCustomTemplates()
  }, [loadHistory, loadCustomTemplates])

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/broadcast/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers, roles, activeOnly }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'PREVIEW_FAILED')
      setPreview(data)
    } catch (e) {
      setError(e.message)
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [tiers, roles, activeOnly])

  // Auto-preview when targeting changes
  useEffect(() => {
    if (tiers.length === 0 && roles.length === 0) {
      setPreview(null)
      return
    }
    const t = setTimeout(fetchPreview, 300)
    return () => clearTimeout(t)
  }, [tiers, roles, activeOnly, fetchPreview])

  const toggleTier = (t) => {
    setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  const toggleRole = (r) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  const canSend =
    subject.trim().length > 0 &&
    htmlBody.trim().length > 0 &&
    (tiers.length > 0 || roles.length > 0) &&
    !!preview &&
    preview.deliverable > 0

  const handleSend = async () => {
    setSending(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, htmlBody, tiers, roles, activeOnly }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'SEND_FAILED')
      setResult(data)
      setConfirmOpen(false)
      // Reset composer on success
      setSubject('')
      setHtmlBody('')
      setSelectedTemplateId(null)
      loadHistory()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B3A6B]/10 text-[#1B3A6B]">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            الرسائل الجماعية
          </h1>
          <p className="text-sm text-gray-500">
            أرسل تحديثات وإعلانات لمشتركين محددين حسب الباقة أو الدور.
          </p>
        </div>
      </div>

      {result && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-900">تم إرسال الحملة بنجاح</AlertTitle>
          <AlertDescription className="text-emerald-800">
            وصلت الرسالة إلى <strong>{result.successCount}</strong> من أصل{' '}
            <strong>{result.totalRecipients}</strong> —
            فشل: <strong>{result.failCount}</strong>، مُلغين اشتراك:{' '}
            <strong>{result.optedOutSkipped}</strong>.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <XCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900">تعذّر التنفيذ</AlertTitle>
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" /> إنشاء حملة جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Template picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#1B3A6B]" /> اختَر قالباً جاهزاً
                  <span className="text-xs font-normal text-gray-400">(اختياري)</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSaveError('')
                    setSaveOpen(true)
                  }}
                  disabled={!subject.trim() || !htmlBody.trim()}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Save className="h-3.5 w-3.5" /> حفظ الرسالة الحالية كقالب
                </Button>
              </div>

              {/* Custom templates section */}
              {(customLoading || customTemplates.length > 0) && (
                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <BookMarked className="h-3.5 w-3.5" /> قوالبك المحفوظة
                    {!customLoading && (
                      <Badge variant="secondary" className="text-[10px]">
                        {customTemplates.length}
                      </Badge>
                    )}
                  </div>
                  {customLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> جارٍ التحميل...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {customTemplates.map((tpl) => {
                        const cat = BROADCAST_TEMPLATE_CATEGORIES.find(
                          (c) => c.key === tpl.category
                        )
                        const active = selectedTemplateId === tpl.id
                        return (
                          <div
                            key={tpl.id}
                            className={`group relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-right transition ${
                              active
                                ? 'border-emerald-500 bg-white ring-1 ring-emerald-500'
                                : 'border-emerald-200 bg-white hover:border-emerald-400'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => applyTemplate(tpl)}
                              className="flex w-full flex-col items-start gap-1 text-right"
                            >
                              <div className="flex w-full items-center justify-between pl-5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-md ${
                                      active
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    <BookMarked className="h-4 w-4" />
                                  </div>
                                  <span className="text-sm font-semibold text-[#1B3A6B]">
                                    {tpl.name}
                                  </span>
                                </div>
                                {cat && (
                                  <Badge className={`text-[10px] font-semibold ${cat.color} border`}>
                                    {cat.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="line-clamp-2 text-[11px] text-gray-500">
                                {tpl.description || tpl.subject}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCustomTemplate(tpl.id)}
                              className="absolute left-2 top-2 rounded p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                              aria-label="حذف القالب"
                              title="حذف القالب"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Built-in templates */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <FileText className="h-3.5 w-3.5" /> قوالب افتراضية
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {BROADCAST_TEMPLATES.map((tpl) => {
                    const Icon = TEMPLATE_ICONS[tpl.icon] || FileText
                    const cat = BROADCAST_TEMPLATE_CATEGORIES.find((c) => c.key === tpl.category)
                    const active = selectedTemplateId === tpl.id
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-right transition ${
                          active
                            ? 'border-[#1B3A6B] bg-[#1B3A6B]/5 ring-1 ring-[#1B3A6B]'
                            : 'border-gray-200 bg-white hover:border-[#1B3A6B]/40 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-md ${
                                active ? 'bg-[#1B3A6B] text-white' : 'bg-gray-100 text-[#1B3A6B]'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold text-[#1B3A6B]">
                              {tpl.name}
                            </span>
                          </div>
                          {cat && (
                            <Badge className={`text-[10px] font-semibold ${cat.color} border`}>
                              {cat.label}
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[11px] text-gray-500">
                          {tpl.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedTemplateId && (
                <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                  <span>
                    ✓ تمّ تحميل القالب — يمكنك تعديل النصّ قبل الإرسال
                  </span>
                  <button
                    type="button"
                    onClick={clearTemplate}
                    className="text-emerald-700 underline hover:text-emerald-900"
                  >
                    مسح
                  </button>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="subject">الموضوع</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: إطلاق ميزة جديدة في المنصّة"
                maxLength={140}
              />
              <div className="text-xs text-gray-400">{subject.length}/140</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">
                المحتوى{' '}
                <span className="text-xs font-normal text-gray-400">
                  (يدعم HTML بسيط مثل &lt;p&gt; و &lt;a&gt; و &lt;strong&gt;)
                </span>
              </Label>
              <Textarea
                id="body"
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder={`<p>مرحباً بك،</p>\n<p>يسرّنا إعلامك بأننا أطلقنا ميزة جديدة...</p>\n<p><a href="https://example.com">اضغط هنا للتفاصيل</a></p>`}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {/* Live preview */}
            {htmlBody.trim() && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Eye className="h-3.5 w-3.5" /> معاينة كيف سيراها المستلم
                </Label>
                <div
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targeting sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> الجمهور المستهدف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">
                  حسب الباقة
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIERS.map((t) => {
                    const active = tiers.includes(t.key)
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleTier(t.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                            : `border-transparent ${t.color} hover:brightness-95`
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-500">
                  حسب الدور
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const active = roles.includes(r.key)
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => toggleRole(r.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
                            : `border-transparent ${r.color} hover:brightness-95`
                        }`}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Separator />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={activeOnly}
                  onCheckedChange={(v) => setActiveOnly(!!v)}
                />
                <span>استبعاد الحسابات المعلَّقة</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> جارٍ حساب المستلمين...
                </div>
              ) : preview ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">إجمالي المطابقين</span>
                    <span className="font-bold text-[#1B3A6B]">{preview.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">مُلغيو الاشتراك</span>
                    <span className="font-bold text-red-500">−{preview.optedOut}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">سيصلهم البريد</span>
                    <span className="text-lg font-extrabold text-emerald-600">
                      {preview.deliverable}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  اختر باقة أو دور لعرض عدد المستلمين.
                </div>
              )}

              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || sending}
                className="w-full bg-[#1B3A6B] hover:bg-[#152c52]"
              >
                {sending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="ml-2 h-4 w-4" /> إرسال الحملة
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-[#1B3A6B]" />
          <h2 className="text-lg font-bold text-[#1B3A6B]">سجل الحملات السابقة</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {historyLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              لم يتم إرسال أي حملة بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-right text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3">الموضوع</th>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3">الاستهداف</th>
                    <th className="px-4 py-3 text-center">مستلمون</th>
                    <th className="px-4 py-3 text-center">نجح</th>
                    <th className="px-4 py-3 text-center">فشل</th>
                    <th className="px-4 py-3">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="line-clamp-1 font-semibold text-[#1B3A6B]">
                          {b.subject}
                        </div>
                        <div className="text-[11px] text-gray-400">بواسطة {b.sentByName || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(b.sentAt || b.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(b.tiers || []).map((t) => (
                            <Badge key={'t' + t} variant="secondary" className="text-[10px]">
                              {TIERS.find((x) => x.key === t)?.label || t}
                            </Badge>
                          ))}
                          {(b.roles || []).map((r) => (
                            <Badge key={'r' + r} variant="outline" className="text-[10px]">
                              {ROLES.find((x) => x.key === r)?.label || r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {b.totalRecipients}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                        {b.successCount}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-red-500">
                        {b.failCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              تأكيد إرسال الحملة
            </DialogTitle>
            <DialogDescription>
              أنت على وشك إرسال بريد إلى{' '}
              <strong className="text-[#1B3A6B]">
                {preview?.deliverable || 0} مستلم
              </strong>
              . هذه العملية لا يمكن التراجع عنها.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-bold text-[#1B3A6B]">{subject}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tiers.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {TIERS.find((x) => x.key === t)?.label || t}
                </Badge>
              ))}
              {roles.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px]">
                  {ROLES.find((x) => x.key === r)?.label || r}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={sending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-[#1B3A6B] hover:bg-[#152c52]"
            >
              {sending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Send className="ml-2 h-4 w-4" /> نعم، أرسل الآن
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Save-as-template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-[#1B3A6B]" />
              حفظ الرسالة الحالية كقالب
            </DialogTitle>
            <DialogDescription>
              سيتمّ حفظ الموضوع والمحتوى الحاليَّين لإعادة استخدامهما لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">اسم القالب</Label>
              <Input
                id="tpl-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="مثال: عرض الخصم الشهري"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">وصف مختصر (اختياري)</Label>
              <Input
                id="tpl-desc"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="متى تستخدمه؟"
                maxLength={240}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">التصنيف</Label>
              <select
                id="tpl-cat"
                value={saveCategory}
                onChange={(e) => setSaveCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {BROADCAST_TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
                <option value="other">أخرى</option>
              </select>
            </div>
            {saveError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {saveError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button
              onClick={saveAsTemplate}
              disabled={saving || !saveName.trim() || !subject.trim() || !htmlBody.trim()}
              className="bg-[#1B3A6B] hover:bg-[#152c52]"
            >
              {saving ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جارٍ الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" /> حفظ القالب
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
