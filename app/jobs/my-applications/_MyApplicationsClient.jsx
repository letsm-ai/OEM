'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Briefcase, Trash2, Eye, Loader2 } from 'lucide-react'
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES, WORK_MODES, labelFrom, formatSalary } from '@/lib/jobs'

export default function MyApplicationsClient() {
  const { status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signup?next=/jobs/my-applications'); return }
    if (status !== 'authenticated') return
    load()

  }, [status])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/me/job-applications')
      const d = await res.json()
      setItems(d.items || [])
    } finally { setLoading(false) }
  }

  const withdraw = async (id) => {
    if (!confirm('سحب تقديمك من هذه الوظيفة؟')) return
    await fetch(`/api/me/job-applications/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div className="py-16 text-center">جارٍ التحميل...</div>

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]">
        <ArrowRight className="h-4 w-4" /> لوحة الوظائف
      </Link>
      <h1 className="mb-4 text-2xl font-extrabold text-[#1B3A6B]">تقديماتي ({items.length})</h1>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 py-12 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm font-semibold">لم تتقدّم على أي وظيفة بعد</p>
          <Link href="/jobs" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm text-white">تصفح الوظائف</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const s = APPLICATION_STATUSES.find((x) => x.key === a.status)
            const job = a.job || {}
            return (
              <div key={a.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold text-[#1B3A6B]">{job.titleAr || 'وظيفة محذوفة'}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s?.color || 'bg-gray-100'}`}>{s?.ar || a.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{job.companyNameAr}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      {job.employmentType && <span>{labelFrom(EMPLOYMENT_TYPES, job.employmentType)}</span>}
                      {job.workMode && <><span>•</span><span>{labelFrom(WORK_MODES, job.workMode)}</span></>}
                      {job.governorate && <><span>•</span><span>{job.governorate}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {job.id && <Link href={`/jobs/${job.id}`} className="rounded-md border px-2 py-1 text-xs"><Eye className="h-3 w-3" /></Link>}
                    {['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(a.status) && (
                      <button onClick={() => withdraw(a.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600">سحب</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
