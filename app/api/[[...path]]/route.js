import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

function handleCORS(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.CORS_ORIGINS || '*'
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Public health check
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(
        NextResponse.json({ message: 'Majles API is running' })
      )
    }

    // -------- SIGNUP --------
    if (route === '/signup' && method === 'POST') {
      const body = await request.json()
      const { name, email, password } = body || {}

      if (!name || !email || !password) {
        return handleCORS(
          NextResponse.json(
            { error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' },
            { status: 400 }
          )
        )
      }

      if (password.length < 6) {
        return handleCORS(
          NextResponse.json(
            { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' },
            { status: 400 }
          )
        )
      }

      await connectDB()
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await User.findOne({ email: normalizedEmail }).lean()
      if (existing) {
        return handleCORS(
          NextResponse.json(
            { error: 'البريد الإلكتروني مسجل مسبقاً' },
            { status: 409 }
          )
        )
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: 'MEMBER',
        membershipTier: 'FREE',
      })

      return handleCORS(
        NextResponse.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            membershipTier: user.membershipTier,
          },
        })
      )
    }

    // -------- ME --------
    if (route === '/me' && method === 'GET') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return handleCORS(
          NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
        )
      }
      await connectDB()
      const user = await User.findById(session.user.id).lean()
      if (!user) {
        return handleCORS(
          NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
        )
      }
      return handleCORS(
        NextResponse.json({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          membershipTier: user.membershipTier,
          membershipExpiry: user.membershipExpiry,
          createdAt: user.createdAt,
        })
      )
    }

    return handleCORS(
      NextResponse.json({ error: `Route ${route} not found` }, { status: 404 })
    )
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(
      NextResponse.json(
        { error: 'خطأ داخلي في الخادم' },
        { status: 500 }
      )
    )
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
