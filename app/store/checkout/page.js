import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import CheckoutClient from './_CheckoutClient'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions)
  // Guest checkout allowed — no redirect. Pass session state to client.
  let u = null
  if (session?.user) {
    await connectDB()
    u = await User.findById(session.user.id).lean()
  }
  return (
    <CheckoutClient
      isLoggedIn={!!session?.user}
      tier={u?.membershipTier || 'FREE'}
      user={{
        name: u?.name || '',
        email: u?.email || '',
        phone: u?.phone || '',
      }}
    />
  )
}
