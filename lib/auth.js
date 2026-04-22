import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import { User } from './models'

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان')
        }
        await connectDB()
        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
        }).lean()

        if (!user) {
          throw new Error('بيانات الدخول غير صحيحة')
        }

        const ok = await bcrypt.compare(credentials.password, user.password)
        if (!ok) {
          throw new Error('بيانات الدخول غير صحيحة')
        }

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          membershipTier: user.membershipTier,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.membershipTier = user.membershipTier
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.membershipTier = token.membershipTier
      }
      return session
    },
  },
}

/**
 * Check if a user has at least one of the required roles.
 * @param {object} session NextAuth session
 * @param {string[]} roles list of allowed roles
 */
export function hasRole(session, roles = []) {
  if (!session?.user?.role) return false
  return roles.includes(session.user.role)
}

/**
 * Check if a user has at least the given membership tier.
 */
const TIER_ORDER = { FREE: 0, BASIC: 1, GOLD: 2, PLATINUM: 3 }
export function hasTier(session, minTier = 'FREE') {
  if (!session?.user?.membershipTier) return false
  return TIER_ORDER[session.user.membershipTier] >= TIER_ORDER[minTier]
}
