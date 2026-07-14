'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Menu, X, LogOut, User as UserIcon, BookOpen, Sparkles, Shield } from 'lucide-react'
import { useI18n } from '@/lib/i18n/I18nContext'
import LangSwitcher from '@/components/LangSwitcher'

export default function Navbar() {
  const { t } = useI18n()
  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/store', label: t('nav.store') },
    { href: '/consultations', label: t('nav.consultations') },
    { href: '/directory', label: t('nav.directory') },
    { href: '/membership', label: t('nav.membership') },
    { href: '/dashboard', label: t('nav.dashboard') },
  ]
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState('')

  useEffect(() => {
    let cancelled = false
    if (session?.user?.id) {
      fetch('/api/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.photo) setPhoto(d.photo)
        })
        .catch(() => {})
    } else {
      setPhoto('')
    }
    return () => {
      cancelled = true
    }
  }, [session?.user?.id, session?.user?.name])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo — icon-only in the navbar for a compact, prominent brand mark.
            The full wordmark is only shown in the footer. */}
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="مجلس رواد الأعمال العماني"
        >
          <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
            <Image
              src="/logo-icon.png"
              alt="شعار مجلس رواد الأعمال العماني"
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[#F8F9FA] hover:text-[#1B3A6B]"
            >
              {l.label}
            </Link>
          ))}
          {/* Highlighted User Guide — draws new users' attention */}
          <Link
            href="/help/user"
            className="group relative inline-flex items-center gap-1.5 rounded-md bg-gradient-to-bl from-[#C9A84C] to-[#b89440] px-3 py-2 text-sm font-bold text-white shadow-sm ring-1 ring-[#C9A84C]/40 transition hover:shadow-md hover:brightness-110"
          >
            <BookOpen className="h-4 w-4" />
            {t('nav.help')}
            <span className="pointer-events-none absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          </Link>
          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1B3A6B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#152c52]"
            >
              <Shield className="h-4 w-4" />
              {t('nav.admin.panel')}
            </Link>
          )}
          {session?.user?.role === 'EXPERT' && (
            <Link
              href="/expert"
              className="inline-flex items-center gap-1 rounded-md bg-[#1B3A6B]/10 px-3 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B]/20"
            >
              {t('nav.expert.panel')}
            </Link>
          )}
        </nav>

        {/* Auth area */}
        <div className="hidden items-center gap-2 lg:flex">
          <LangSwitcher />
          {status === 'loading' ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-gray-200" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full bg-[#F8F9FA] px-3 py-1.5 transition hover:bg-[#eef1f5]"
                title={t('nav.settings')}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    className="h-6 w-6 rounded-full border border-gray-200 object-cover"
                  />
                ) : (
                  <UserIcon className="h-4 w-4 text-[#1B3A6B]" />
                )}
                <span className="text-sm font-medium text-[#1B3A6B]">
                  {session.user.name}
                </span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-4 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152c52]"
              >
                {t('nav.signup')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu btn */}
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-[#1B3A6B] lg:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-100 bg-white lg:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#F8F9FA] hover:text-[#1B3A6B]"
              >
                {l.label}
              </Link>
            ))}
            {/* Highlighted User Guide in mobile menu */}
            <Link
              href="/help/user"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-bl from-[#C9A84C] to-[#b89440] px-3 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ring-[#C9A84C]/40"
            >
              <BookOpen className="h-4 w-4" />
              {t('nav.help')}
              <Sparkles className="h-3.5 w-3.5" />
            </Link>
            <div className="my-2 h-px bg-gray-100" />
            <div className="px-3 py-1">
              <LangSwitcher variant="compact" />
            </div>
            {session?.user?.role === 'ADMIN' && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1B3A6B] px-3 py-2.5 text-sm font-semibold text-white"
              >
                <Shield className="h-4 w-4" />
                {t('nav.admin.panel')}
              </Link>
            )}
            {session?.user ? (
              <>
                <div className="px-3 py-2 text-sm text-gray-600">
                  {t('nav.welcome')} <span className="font-semibold text-[#1B3A6B]">{session.user.name}</span>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
                >
                  {t('nav.settings')}
                </Link>
                <button
                  onClick={() => {
                    setOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                  className="rounded-md border border-gray-300 px-3 py-2 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-[#1B3A6B] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#152c52]"
                >
                  {t('nav.signup')}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
