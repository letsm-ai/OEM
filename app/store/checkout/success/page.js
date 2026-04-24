import { Suspense } from 'react'
import SuccessClient from './_SuccessClient'

export const dynamic = 'force-dynamic'

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-gray-500">جارٍ التحميل...</div>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  )
}
