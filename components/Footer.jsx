'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'

export default function Footer() {
  const { t, lang } = useI18n()
  const year = new Date().getFullYear()
  const brandName = lang === 'ar' ? 'مجلس رواد الأعمال العماني' : 'Omani Entrepreneur Majles'
  return (
    <footer className="border-t border-gray-200 bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] text-gray-200">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-14 w-[170px] shrink-0">
                <Image
                  src="/logo.png"
                  alt={brandName}
                  fill
                  sizes="170px"
                  className="object-contain object-right"
                />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-300">
              {t('footer.about')}
            </p>
          </div>

          {/* Sections */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">{t('footer.quicklinks')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/store" className="transition hover:text-[#C9A84C]">{t('nav.store')}</Link></li>
              <li><Link href="/consultations" className="transition hover:text-[#C9A84C]">{t('nav.consultations')}</Link></li>
              <li><Link href="/directory" className="transition hover:text-[#C9A84C]">{t('nav.directory')}</Link></li>
              <li><Link href="/membership" className="transition hover:text-[#C9A84C]">{t('nav.membership')}</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">{t('nav.dashboard')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="transition hover:text-[#C9A84C]">{t('nav.login')}</Link></li>
              <li><Link href="/signup" className="transition hover:text-[#C9A84C]">{t('nav.signup')}</Link></li>
              <li><Link href="/dashboard/vendor" className="transition hover:text-[#C9A84C]">{lang === 'ar' ? 'لوحة البائع' : 'Vendor Panel'}</Link></li>
              <li><Link href="/store/wishlist" className="transition hover:text-[#C9A84C]">{lang === 'ar' ? 'قائمة الأمنيات' : 'Wishlist'}</Link></li>
            </ul>
          </div>

          {/* Contact + Socials */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-[#C9A84C]">{t('footer.contact')}</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#C9A84C]" />
                <span>{lang === 'ar' ? 'مسقط، سلطنة عُمان' : 'Muscat, Sultanate of Oman'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#C9A84C]" />
                <a href="mailto:support@omanimajles.com" dir="ltr" className="transition hover:text-[#C9A84C]">
                  support@omanimajles.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#C9A84C]" />
                <a href="tel:+96895141641" dir="ltr" className="transition hover:text-[#C9A84C]">
                  +968 9514 1641
                </a>
              </li>
            </ul>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://www.instagram.com/oem_2020/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:border-[#C9A84C] hover:bg-[#C9A84C] hover:text-[#1B3A6B]"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-gray-400">
          <div>© {year} {brandName} — {t('footer.copyright')}</div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/help/user" className="transition hover:text-[#C9A84C]">{t('footer.help')}</Link>
            <Link href="/privacy" className="transition hover:text-[#C9A84C]">{t('footer.privacy')}</Link>
            <Link href="/terms" className="transition hover:text-[#C9A84C]">{t('footer.terms')}</Link>
            <Link href="/refund" className="transition hover:text-[#C9A84C]">{t('footer.refund')}</Link>
            <Link href="/shipping" className="transition hover:text-[#C9A84C]">{t('footer.shipping')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
