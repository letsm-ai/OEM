import { Inbox } from 'lucide-react'
import Link from 'next/link'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'لا توجد بيانات',
  description = '',
  actionLabel,
  actionHref,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-[#1B3A6B]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#152c52]"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#152c52]"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
