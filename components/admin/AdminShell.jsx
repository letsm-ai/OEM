'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Shield,
  LayoutDashboard,
  BarChart3,
  Users,
  CheckCircle2,
  Wallet,
  Building2,
  GraduationCap,
  Store,
  ShoppingBag,
  Tag,
  Bell,
  MailX,
  Sliders,
  BookOpen,
  Home,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Trash2,
} from 'lucide-react'

const groups = [
  {
    label: 'نظرة عامة',
    items: [
      { href: '/admin', label: 'الرئيسية', Icon: LayoutDashboard, exact: true },
      { href: '/admin/analytics', label: 'الإحصائيات', Icon: BarChart3 },
    ],
  },
  {
    label: 'المستخدمون',
    items: [
      { href: '/admin/users', label: 'إدارة المستخدمين', Icon: Users },
      { href: '/admin/approvals', label: 'مركز الموافقات', Icon: CheckCircle2 },
    ],
  },
  {
    label: 'التجار والخبراء',
    items: [
      { href: '/admin/companies', label: 'الشركات', Icon: Building2 },
      { href: '/admin/experts', label: 'الخبراء', Icon: GraduationCap },
      { href: '/admin/vendor-applications', label: 'طلبات البائعين', Icon: Store },
    ],
  },
  {
    label: 'المالية',
    items: [
      { href: '/admin/revenue', label: 'تقرير الإيرادات', Icon: Wallet },
      { href: '/admin/payouts', label: 'المدفوعات', Icon: ShoppingBag },
      { href: '/admin/coupons', label: 'الكوبونات', Icon: Tag },
    ],
  },
  {
    label: 'الاتصالات',
    items: [
      { href: '/admin/broadcast', label: 'الرسائل الجماعية', Icon: Send },
      { href: '/admin/notifications', label: 'الإشعارات', Icon: Bell },
      { href: '/admin/email-optouts', label: 'إلغاء اشتراك الإيميل', Icon: MailX },
    ],
  },
  {
    label: 'النظام',
    items: [
      { href: '/admin/settings', label: 'الإعدادات', Icon: Sliders },
      { href: '/admin/cleanup', label: 'تنظيف البيانات', Icon: Trash2 },
      { href: '/help/admin', label: 'دليل الأدمن', Icon: BookOpen },
    ],
  },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function currentTitle(pathname) {
  for (const g of groups) {
    for (const item of g.items) {
      if (isActive(pathname, item)) return item.label
    }
  }
  return 'لوحة الإدارة'
}

function SidebarBody({ user, pathname, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-bl from-[#1B3A6B] to-[#2b5aa0] text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[#1B3A6B]">لوحة الإدارة</div>
            <div className="truncate text-[11px] text-gray-500">
              {user?.name || 'Admin'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-4 px-2 pb-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {g.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const active = isActive(pathname, item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition',
                        active
                          ? 'bg-[#1B3A6B] font-semibold text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-[#1B3A6B]',
                      )}
                    >
                      <item.Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-white' : 'text-gray-400 group-hover:text-[#1B3A6B]',
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-[#1B3A6B]"
        >
          <Home className="h-4 w-4 text-gray-400" />
          <span>العودة للموقع</span>
        </Link>
      </div>
    </div>
  )
}

export default function AdminShell({ user, children }) {
  const pathname = usePathname() || '/admin'
  const title = currentTitle(pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopHidden, setDesktopHidden] = useState(false)

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-[#F8F9FA]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-l bg-white transition-[width] duration-200 md:block',
          desktopHidden ? 'w-0 overflow-hidden' : 'w-64',
        )}
      >
        <div className="sticky top-0 h-[calc(100vh-4rem)] w-64">
          <SidebarBody user={user} pathname={pathname} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-white/95 px-4 backdrop-blur">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="فتح القائمة">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SidebarBody
                user={user}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Desktop toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="إخفاء القائمة"
            onClick={() => setDesktopHidden((v) => !v)}
          >
            {desktopHidden ? (
              <PanelRightOpen className="h-5 w-5" />
            ) : (
              <PanelRightClose className="h-5 w-5" />
            )}
          </Button>

          <div className="h-6 w-px bg-gray-200" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1B3A6B]" />
              <h1 className="text-sm font-bold text-[#1B3A6B]">{title}</h1>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              وضع الأدمن
            </Badge>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
