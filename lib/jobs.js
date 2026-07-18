/**
 * Shared constants + label helpers for the Jobs feature.
 */

export const EMPLOYMENT_TYPES = [
  { key: 'FULL_TIME', ar: 'دوام كامل' },
  { key: 'PART_TIME', ar: 'دوام جزئي' },
  { key: 'CONTRACT', ar: 'عقد مؤقت' },
  { key: 'INTERNSHIP', ar: 'تدريب' },
  { key: 'FREELANCE', ar: 'عمل حر' },
]

export const WORK_MODES = [
  { key: 'ONSITE', ar: 'من مقر الشركة' },
  { key: 'REMOTE', ar: 'عن بُعد' },
  { key: 'HYBRID', ar: 'هجين' },
]

export const EXPERIENCE_LEVELS = [
  { key: 'ENTRY', ar: 'مبتدئ (0-2 سنوات)' },
  { key: 'MID', ar: 'متوسط (2-5 سنوات)' },
  { key: 'SENIOR', ar: 'خبير (5-10 سنوات)' },
  { key: 'EXECUTIVE', ar: 'قيادي (10+ سنوات)' },
]

export const EDUCATION_LEVELS = [
  { key: 'HIGH_SCHOOL', ar: 'ثانوية' },
  { key: 'DIPLOMA', ar: 'دبلوم' },
  { key: 'BACHELOR', ar: 'بكالوريوس' },
  { key: 'MASTER', ar: 'ماجستير' },
  { key: 'PHD', ar: 'دكتوراه' },
]

export const APPLICATION_STATUSES = [
  { key: 'SUBMITTED', ar: 'قيد المراجعة', color: 'bg-blue-100 text-blue-800' },
  { key: 'VIEWED', ar: 'تمّ الاطلاع', color: 'bg-slate-100 text-slate-800' },
  { key: 'SHORTLISTED', ar: 'في القائمة القصيرة', color: 'bg-amber-100 text-amber-800' },
  { key: 'REJECTED', ar: 'مرفوض', color: 'bg-red-100 text-red-800' },
  { key: 'HIRED', ar: 'تمّ التوظيف', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'WITHDRAWN', ar: 'مسحوب', color: 'bg-gray-100 text-gray-700' },
]

export function labelFrom(list, key) {
  const item = list.find((x) => x.key === key)
  return item?.ar || key || ''
}

export function formatSalary(job) {
  if (job?.salaryHidden) return null
  const min = Number(job?.salaryMin || 0)
  const max = Number(job?.salaryMax || 0)
  if (!min && !max) return null
  const cur = job.salaryCurrency || 'OMR'
  if (min && max && max > min) return `${min}–${max} ${cur === 'OMR' ? 'ر.ع' : cur}`
  const val = max || min
  return `${val} ${cur === 'OMR' ? 'ر.ع' : cur}`
}

export function daysUntil(date) {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}
