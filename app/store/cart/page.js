import CartClient from './_CartClient'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const session = await getServerSession(authOptions)
  let tier = 'FREE'
  if (session?.user) {
    await connectDB()
    const u = await User.findById(session.user.id).lean()
    tier = u?.membershipTier || 'FREE'
  }
  return <CartClient tier={tier} authed={!!session?.user} />
}
