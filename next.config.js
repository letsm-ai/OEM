const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Disable PWA in development to avoid stale cache while coding.
  disable: process.env.NODE_ENV === 'development',
  // Do not precache API responses or NextAuth internals.
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets' },
    },
    {
      // Cache GET data APIs (products/companies/experts listings) briefly.
      urlPattern: ({ url, request }) =>
        request.method === 'GET' &&
        /^\/api\/(products|companies|experts|tags)/.test(url.pathname),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-data',
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 5 },
        networkTimeoutSeconds: 5,
      },
    },
    {
      // Do NOT cache auth or write endpoints — always network only.
      urlPattern: /^\/api\/(auth|checkout|webhooks|signup|me|admin|membership)/,
      handler: 'NetworkOnly',
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      }
    }
    return config
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ORIGINS || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
