/**
 * Shared helpers for API handlers.
 */
import { NextResponse } from 'next/server'

export function handleCORS(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.CORS_ORIGINS || '*'
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export const json = (data, init) =>
  handleCORS(NextResponse.json(data, init))

export const ok = (data = {}) => json({ success: true, ...data })
export const err = (message, status = 400) =>
  json({ error: message }, { status })

export const requireAuth = (session) =>
  !session?.user ? err('غير مصرح', 401) : null

export const requireRole = (session, roles) => {
  const unauth = requireAuth(session)
  if (unauth) return unauth
  const r = session.user.role
  if (!roles.includes(r)) {
    const msg =
      roles.includes('ADMIN') && !roles.includes('VENDOR')
        ? 'صلاحيات مسؤول مطلوبة'
        : 'صلاحيات بائع مطلوبة'
    return err(msg, 403)
  }
  return null
}
