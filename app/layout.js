import './globals.css'
import { cookies } from 'next/headers'
import { Cairo } from 'next/font/google'
import Providers from '@/components/Providers'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import WhatsAppFab from '@/components/WhatsAppFab'
import InstallPrompt from '@/components/InstallPrompt'
import { I18nProvider } from '@/lib/i18n/I18nContext'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/translations'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
})

export const metadata = {
  title: 'مجلس رواد الأعمال العماني | Omani Entrepreneur Majles',
  description: 'منظومة رواد الأعمال العمانيين - مجلس رواد الأعمال العماني',
  applicationName: 'مجلس رواد الأعمال العماني',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'مجلس رواد الأعمال',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: '#1B3A6B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies()
  const langCookie = cookieStore.get('lang')?.value
  const lang = SUPPORTED_LOCALES.includes(langCookie) ? langCookie : DEFAULT_LOCALE
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  return (
    <html lang={lang} dir={dir} className={cairo.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);',
          }}
        />
        {/* PWA Apple splash screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="مجلس رواد الأعمال" />
      </head>
      <body className={`${cairo.className} min-h-screen bg-[#F8F9FA] text-gray-900 antialiased`}>
        <I18nProvider initialLocale={lang}>
          <Providers>
            <Navbar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <Footer />
            <WhatsAppFab />
            <InstallPrompt />
          </Providers>
        </I18nProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}
