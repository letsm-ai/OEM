'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'الرئيسية' },
  { href: '/shop', label: 'المتجر' },
  { href: '/consultations', label: 'الاستشارات' },
  { href: '/directory', label: 'دليل الشركات' },
  { href: '/membership', label: 'العضوية' },
  { href: '/dashboard', label: 'حسابي' },
]

export default function Navbar() {
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
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B3A6B]">
            <span className="text-lg font-bold text-[#C9A84C]">م</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-[#1B3A6B]">مجلس رواد الأعمال</span>
            <span className="text-[10px] text-gray-500">العماني</span>
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
          {session?.user?.role === 'ADMIN' && (
            <>
              <Link
                href="/admin/companies"
                className="inline-flex items-center gap-1 rounded-md bg-[#C9A84C]/20 px-3 py-2 text-sm font-semibold text-[#8a6f2d] hover:bg-[#C9A84C]/30"
              >
                الشركات
              </Link>
              <Link
                href="/admin/experts"
                className="inline-flex items-center gap-1 rounded-md bg-[#C9A84C]/20 px-3 py-2 text-sm font-semibold text-[#8a6f2d] hover:bg-[#C9A84C]/30"
              >
                الخبراء
              </Link>
            </>
          )}
          {session?.user?.role === 'EXPERT' && (
            <Link
              href="/expert"
              className="inline-flex items-center gap-1 rounded-md bg-[#1B3A6B]/10 px-3 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B]/20"
            >
              لوحة الخبير
            </Link>
          )}
        </nav>

        {/* Auth area */}
        <div className="hidden items-center gap-2 lg:flex">
          {status === 'loading' ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-gray-200" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-full bg-[#F8F9FA] px-3 py-1.5 transition hover:bg-[#eef1f5]"
                title="إعدادات الحساب"
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
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-4 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152c52]"
              >
                انضم الآن
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
            <div className="my-2 h-px bg-gray-100" />
            {session?.user ? (
              <>
                <div className="px-3 py-2 text-sm text-gray-600">
                  مرحباً، <span className="font-semibold text-[#1B3A6B]">{session.user.name}</span>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
                >
                  إعدادات الحساب
                </Link>
                <button
                  onClick={() => {
                    setOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                  className="rounded-md border border-gray-300 px-3 py-2 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-[#1B3A6B] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#152c52]"
                >
                  انضم الآن
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
