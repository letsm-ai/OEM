import { NextResponse } from 'next/server'

/**
 * Attach permissive CORS + credential headers to any NextResponse.
 * Shared between the legacy `[[...path]]/route.js` catch-all and the
 * newly-split per-route files (see /app/app/api/admin/broadcast/**).
 */
export function withCORS(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    process.env.CORS_ORIGINS || '*'
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

/** Standard `OPTIONS` preflight response for a route file. */
export function optionsResponse() {
  return withCORS(new NextResponse(null, { status: 200 }))
}
