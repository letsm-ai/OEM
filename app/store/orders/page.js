import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OrdersClient from './_OrdersClient'

export const dynamic = 'force-dynamic'

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/store/orders')
  }
  return <OrdersClient />
}
