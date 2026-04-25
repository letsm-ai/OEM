import Link from 'next/link'
import { Facebook, Instagram, Twitter, Linkedin, Mail, MapPin, Phone } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-gray-200 bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] text-gray-200">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C9A84C] text-[#1B3A6B] font-extrabold">
                ر
              </div>
              <div>
                <div className="font-extrabold text-white">مجلس رواد الأعمال</div>
                <div className="-mt-0.5 text-xs text-[#C9A84C]">العماني</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              منظومة رواد الأعمال العمانيين — نجمع رواد الأعمال في منصة واحدة لبناء شراكات وتوسيع الأعمال محلياً وإقليمياً.
            </p>
          </div>

          {/* Sections */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">الأقسام</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/store" className="transition hover:text-[#C9A84C]">المتجر</Link></li>
              <li><Link href="/consultations" className="transition hover:text-[#C9A84C]">الاستشارات</Link></li>
              <li><Link href="/directory" className="transition hover:text-[#C9A84C]">دليل الشركات</Link></li>
              <li><Link href="/membership" className="transition hover:text-[#C9A84C]">العضوية</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">الحساب</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="transition hover:text-[#C9A84C]">تسجيل الدخول</Link></li>
              <li><Link href="/signup" className="transition hover:text-[#C9A84C]">إنشاء حساب</Link></li>
              <li><Link href="/dashboard/vendor" className="transition hover:text-[#C9A84C]">لوحة البائع</Link></li>
              <li><Link href="/store/wishlist" className="transition hover:text-[#C9A84C]">قائمة الأمنيات</Link></li>
            </ul>
          </div>

          {/* Contact + Socials */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">تواصل معنا</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#C9A84C]" />
                <span>مسقط، سلطنة عُمان</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#C9A84C]" />
                <span dir="ltr">info@majles-oman.om</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#C9A84C]" />
                <span dir="ltr">+968 9000 0000</span>
              </li>
            </ul>
            <div className="mt-4 flex items-center gap-2">
              {[
                { Icon: Facebook, href: '#', label: 'فيسبوك' },
                { Icon: Instagram, href: '#', label: 'إنستغرام' },
                { Icon: Twitter, href: '#', label: 'تويتر' },
                { Icon: Linkedin, href: '#', label: 'لينكد إن' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-[#C9A84C] hover:bg-[#C9A84C] hover:text-[#1B3A6B]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-gray-400">
          <div>© {year} مجلس رواد الأعمال العماني — جميع الحقوق محفوظة</div>
          <div className="flex items-center gap-4">
            <Link href="#" className="transition hover:text-[#C9A84C]">سياسة الخصوصية</Link>
            <Link href="#" className="transition hover:text-[#C9A84C]">الشروط والأحكام</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
