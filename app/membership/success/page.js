import { Suspense } from 'react'
import MembershipSuccessClient from './_SuccessClient'

export const dynamic = 'force-dynamic'

export default function MembershipSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-gray-500">جارٍ التحميل...</div>
        </div>
      }
    >
      <MembershipSuccessClient />
    </Suspense>
  )
}
