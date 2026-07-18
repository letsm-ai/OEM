'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowRight, Building2, MapPin, Briefcase, Clock, Users, Send, Check, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { EMPLOYMENT_TYPES, WORK_MODES, EXPERIENCE_LEVELS, labelFrom, formatSalary, daysUntil } from '@/lib/jobs'
import { sectorLabel, governorateLabel } from '@/lib/directory'

export default function JobDetailClient({ jobId }) {
  const { status } = useSession()
  const router = useRouter()
  const [job, setJob] = useState(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        const d = await res.json()
        if (cancel) return
        if (!res.ok) return setLoading(false)
        setJob(d.job)
        setAlreadyApplied(!!d.alreadyApplied)
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    return () => { cancel = true }
  }, [jobId])

  const submitApply = async () => {
    if (status !== 'authenticated') {
      router.push(`/signup?next=/jobs/${jobId}`)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverLetter }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (d.code === 'PROFILE_INCOMPLETE') {
          setToast({ type: 'error', msg: d.error, action: { href: '/jobs/my-profile', text: 'إكمال ملفي' } })
        } else if (d.code === 'DUPLICATE') {
          setAlreadyApplied(true)
          setToast({ type: 'info', msg: d.error })
        } else {
          setToast({ type: 'error', msg: d.error || 'خطأ' })
        }
        setSubmitting(false)
        return
      }
      setAlreadyApplied(true)
      setApplyOpen(false)
      setToast({ type: 'success', msg: 'تم إرسال تقديمك بنجاح! ستصلك رسالة عند الرد.' })
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      setToast({ type: 'error', msg: 'خطأ في الاتصال' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-500">جارٍ التحميل...</div>
  if (!job) return <div className="py-20 text-center text-gray-500">الوظيفة غير موجودة أو مغلقة</div>

  const daysLeft = daysUntil(job.applyDeadline)
  const salary = formatSalary(job)
  const isClosed = job.status !== 'ACTIVE'

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]">
        <ArrowRight className="h-4 w-4" /> عودة لكل الوظائف
      </Link>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : toast.type === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <span>{toast.msg}</span>
          {toast.action && <Link href={toast.action.href} className="font-semibold underline">{toast.action.text}</Link>}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
            {job.companyLogo ? (
              
              <img src={job.companyLogo} alt="" className="h-full w-full object-cover" />
            ) : <Building2 className="h-8 w-8 text-gray-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-[#1B3A6B] md:text-2xl">{job.titleAr}</h1>
            <p className="mt-1 text-sm text-gray-600">
              <Link href={`/directory/${job.companyId}`} className="hover:underline">{job.companyNameAr}</Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge icon={MapPin}>{governorateLabel(job.governorate)}{job.city ? ` — ${job.city}` : ''}</Badge>
              <Badge icon={Briefcase} tone="blue">{labelFrom(EMPLOYMENT_TYPES, job.employmentType)}</Badge>
              <Badge tone="purple">{labelFrom(WORK_MODES, job.workMode)}</Badge>
              <Badge tone="amber">{labelFrom(EXPERIENCE_LEVELS, job.experienceLevel)}</Badge>
              <Badge>{sectorLabel(job.sector)}</Badge>
              {salary && <Badge tone="emerald">💰 {salary}</Badge>}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {job.applicantsCount} متقدم</span>
          {daysLeft !== null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {daysLeft > 0 ? `متبقي ${daysLeft} يوم للتقديم` : 'ينتهي اليوم'}
            </span>
          )}
        </div>

        {/* Apply CTA */}
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {isClosed ? (
            <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">هذه الوظيفة مغلقة</div>
          ) : alreadyApplied ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> لقد تقدّمت على هذه الوظيفة
            </div>
          ) : (
            <button
              onClick={() => setApplyOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#152c52]"
            >
              <Send className="h-4 w-4" /> تقدّم الآن
            </button>
          )}
          <Link href={`/directory/${job.companyId}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-[#1B3A6B]">
            <Building2 className="h-4 w-4" /> صفحة الشركة
          </Link>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Section title="الوصف الوظيفي">
            <p className="whitespace-pre-wrap text-sm leading-8 text-gray-700">{job.descriptionAr}</p>
          </Section>
          {job.responsibilities?.length > 0 && (
            <Section title="المسؤوليات">
              <List items={job.responsibilities} />
            </Section>
          )}
          {job.requirements?.length > 0 && (
            <Section title="المتطلبات">
              <List items={job.requirements} />
            </Section>
          )}
          {job.benefits?.length > 0 && (
            <Section title="المزايا">
              <List items={job.benefits} />
            </Section>
          )}
        </div>
        <div className="space-y-4">
          {job.skills?.length > 0 && (
            <Section title="المهارات المطلوبة">
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <span key={s} className="rounded-full bg-[#1B3A6B]/8 px-3 py-1 text-xs text-[#1B3A6B]">{s}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Apply modal */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-[#1B3A6B]">التقديم على: {job.titleAr}</h3>
            <p className="mb-4 text-xs text-gray-500">سيتم إرسال ملفك المهني مع رسالة اختيارية أدناه.</p>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="لماذا أنت الشخص المناسب لهذه الوظيفة؟ (اختياري)"
              rows={6}
              maxLength={1500}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#1B3A6B] focus:outline-none"
            />
            <div className="mt-1 text-[10px] text-gray-400 text-left">{coverLetter.length} / 1500</div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setApplyOpen(false)} disabled={submitting} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
              <button onClick={submitApply} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'جارٍ الإرسال...' : 'تأكيد التقديم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-2 text-sm font-bold text-[#1B3A6B]">{title}</h2>
      {children}
    </div>
  )
}

function List({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function Badge({ icon: Icon, tone = 'default', children }) {
  const toneClasses = {
    default: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${toneClasses[tone]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
