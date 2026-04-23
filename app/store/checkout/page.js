import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import CheckoutClient from './_CheckoutClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/store/checkout')
  await connectDB()
  const u = await User.findById(session.user.id).lean()
  return (
    <CheckoutClient
      tier={u?.membershipTier || 'FREE'}
      user={{ name: u?.name || '', email: u?.email || '', phone: u?.phone || '' }}
    />
  )
}
