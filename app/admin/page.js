import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import {
  Shield,
  BarChart3,
  Users,
  CheckCircle2,
  Wallet,
  Building2,
  GraduationCap,
  Store,
  Tag,
  ShoppingBag,
  Bell,
  BookOpen,
  MailX,
  Sliders,
  ArrowLeft,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
        <p className="mt-2 text-sm text-gray-600">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    )
  }

  const sections = [
    { href: '/admin/analytics', label: 'لوحة الإحصائيات', desc: 'عرض KPIs ورسوم بيانية', Icon: BarChart3, color: 'from-blue-500 to-blue-700' },
    { href: '/admin/users', label: 'إدارة المستخدمين', desc: 'تغيير الأدوار وتعليق الحسابات', Icon: Users, color: 'from-emerald-500 to-emerald-700' },
    { href: '/admin/approvals', label: 'مركز الموافقات', desc: 'شركات ؋ خبراء ؋ بائعون', Icon: CheckCircle2, color: 'from-amber-500 to-amber-700' },
    { href: '/admin/revenue', label: 'تقرير الإيرادات', desc: 'عرض مفصل للإيرادات الشهرية', Icon: Wallet, color: 'from-purple-500 to-purple-700' },
    { href: '/admin/companies', label: 'الشركات', desc: 'إدارة وموافقة الشركات', Icon: Building2, color: 'from-cyan-500 to-cyan-700' },
    { href: '/admin/experts', label: 'الخبراء', desc: 'إدارة وموافقة الخبراء', Icon: GraduationCap, color: 'from-indigo-500 to-indigo-700' },
    { href: '/admin/vendor-applications', label: 'طلبات البائعين', desc: 'تفعيل الحسابات التجارية', Icon: Store, color: 'from-pink-500 to-pink-700' },
    { href: '/admin/payouts', label: 'المدفوعات', desc: 'أرصدة البائعين وطلبات السحب', Icon: ShoppingBag, color: 'from-orange-500 to-orange-700' },
    { href: '/admin/coupons', label: 'الكوبونات', desc: 'إنشاء وإدارة الخصومات', Icon: Tag, color: 'from-rose-500 to-rose-700' },
    { href: '/admin/notifications', label: 'الإشعارات', desc: 'إرسال إشعارات Push للمشتركين', Icon: Bell, color: 'from-teal-500 to-teal-700' },
    { href: '/admin/email-optouts', label: 'إلغاء اشتراك الإيميل', desc: 'إدارة قائمة الملغين وتصدير CSV', Icon: MailX, color: 'from-red-500 to-red-700' },
    { href: '/admin/settings', label: 'إعدادات المنصّة', desc: 'الأسعار، المجانية الشاملة، التجربة المجانية', Icon: Sliders, color: 'from-indigo-500 to-indigo-700' },
    { href: '/help/admin', label: 'دليل الأدمن', desc: 'مرجع شامل لإدارة المنصة', Icon: BookOpen, color: 'from-slate-500 to-slate-700' },
  ]

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
            <Shield className="h-4 w-4" /> لوحة الإدارة
          </div>
          <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
            مرحباً، {session.user.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            جميع أدوات الإدارة في مكان واحد
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`bg-gradient-to-bl ${s.color} px-5 py-4 text-white`}>
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-white/15 p-2">
                    <s.Icon className="h-5 w-5" />
                  </span>
                  <ArrowLeft className="h-4 w-4 opacity-70 transition group-hover:translate-x-[-3px] group-hover:opacity-100" />
                </div>
              </div>
              <div className="p-4">
                <div className="font-bold text-[#1B3A6B]">{s.label}</div>
                <p className="mt-1 text-xs text-gray-500">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
