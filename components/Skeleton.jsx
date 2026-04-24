/* Reusable skeleton loaders for data-fetching pages */

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <Skeleton className="mb-3 h-40 w-full rounded-lg" />
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-2 h-3 w-1/2" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ cards = 8 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
