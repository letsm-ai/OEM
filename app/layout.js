import './globals.css'
import { Cairo } from 'next/font/google'
import Providers from '@/components/Providers'
import Navbar from '@/components/Navbar'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
})

export const metadata = {
  title: 'مجلس رواد الأعمال العماني',
  description: 'منظومة رواد الأعمال العمانيين - مجلس رواد الأعمال العماني',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);',
          }}
        />
      </head>
      <body className={`${cairo.className} min-h-screen bg-[#F8F9FA] text-gray-900 antialiased`}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
