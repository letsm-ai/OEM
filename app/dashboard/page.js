import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, VendorApplication } from '@/lib/models'
import {
  TIER_META,
  TIER_DISCOUNT,
  formatArabicDate,
} from '@/lib/membership'
import { getTrialPolicy, isFreeModeActive, getSettings } from '@/lib/settings'
import {
  User as UserIcon,
  Mail,
  Shield,
  Crown,
  CalendarClock,
  Percent,
  ArrowLeft,
  Sparkles,
  Store,
  Hourglass,
  XCircle,
  Lock,
  Gift,
  Zap,
} from 'lucide-react'
import PushToggleButton from '@/components/PushToggleButton'
import TrialStartButton from '@/components/TrialStartButton'

const ROLE_LABELS = {
  ADMIN: 'مسؤول',
  MEMBER: 'عضو',
  VENDOR: 'بائع',
  EXPERT: 'خبير',
}

const TIER_COLORS = {
  FREE: 'bg-gray-100 text-gray-700',
  BASIC: 'bg-blue-100 text-blue-700',
  GOLD: 'bg-[#C9A84C]/20 text-[#8a6f2d]',
  PLATINUM: 'bg-purple-100 text-purple-700',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard')
  }

  await connectDB()
  const dbUser = await User.findById(session.user.id).lean()
  const user = dbUser || session.user

  const tier = user.membershipTier || 'FREE'
  const tierMeta = TIER_META[tier]
  const discount = TIER_DISCOUNT[tier] || 0
  const expiry = user.membershipExpiry
    ? formatArabicDate(user.membershipExpiry)
    : null

  // ---- Vendor / store status for the "Create Store" quick action ----
  const isVendor = user.role === 'VENDOR' || user.role === 'ADMIN'
  const canApplyVendor = ['GOLD', 'PLATINUM'].includes(tier)
  const vendorApp = !isVendor
    ? await VendorApplication.findOne({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .lean()
    : null
  const vendorState = isVendor
    ? 'ACTIVE'
    : vendorApp?.status === 'PENDING'
      ? 'PENDING'
      : vendorApp?.status === 'REJECTED'
        ? 'REJECTED'
        : canApplyVendor
          ? 'CAN_APPLY'
          : 'LOCKED'

  // ---- Trial + Free-mode state (drive dashboard banners) ----
  const trialPolicy = await getTrialPolicy()
  const freeModeActive = await isFreeModeActive()
  const settings = await getSettings()
  const now = new Date()
  const isOnTrial =
    user.trialUsed &&
    user.trialEnd &&
    new Date(user.trialEnd) > now &&
    tier !== 'FREE'
  const trialDaysLeft = isOnTrial
    ? Math.max(0, Math.ceil((new Date(user.trialEnd) - now) / (1000 * 60 * 60 * 24)))
    : 0
  const canStartTrial =
    trialPolicy.enabled &&
    !user.trialUsed &&
    (tier === 'FREE' ||
      !user.membershipExpiry ||
      new Date(user.membershipExpiry) <= now)

  // Compute days remaining
  let daysLeft = null
  if (user.membershipExpiry) {
    const diff = new Date(user.membershipExpiry).getTime() - Date.now()
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Free-mode banner (site-wide promo controlled by admin) */}
        {freeModeActive && (settings.freeMode.bannerAr || settings.freeMode.bannerEn) && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-gradient-to-l from-amber-50 to-amber-100 p-4 text-amber-900 shadow-sm">
            <Zap className="h-8 w-8 shrink-0 text-amber-500" />
            <div className="flex-1 text-sm font-bold">
              {settings.freeMode.bannerAr || settings.freeMode.bannerEn}
            </div>
            <Link
              href="/membership"
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              اشترك الآن
            </Link>
          </div>
        )}

        {/* Trial in progress banner */}
        {isOnTrial && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-purple-200 bg-gradient-to-l from-purple-50 to-white p-4 shadow-sm">
            <Gift className="h-8 w-8 shrink-0 text-purple-500" />
            <div className="flex-1">
              <div className="text-sm font-bold text-purple-900">
                أنت في تجربة مجانية لباقة {tierMeta.nameAr}
              </div>
              <div className="mt-0.5 text-xs text-purple-700">
                تبقّى <span className="font-extrabold">{trialDaysLeft}</span> يوم من تجربتك — اشترك قبل الانتهاء للاستمرار.
              </div>
            </div>
            <Link
              href="/membership"
              className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600"
            >
              اشترك
            </Link>
          </div>
        )}

        {/* Trial CTA for eligible new users */}
        {canStartTrial && !isOnTrial && !freeModeActive && (
          <div className="mb-6 rounded-2xl border border-[#C9A84C]/40 bg-gradient-to-l from-[#C9A84C]/10 to-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A84C] text-white">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-[#1B3A6B]">
                  🎁 جرّب أي باقة مدفوعة مجاناً لمدة {trialPolicy.durationDays} يوم!
                </div>
                <div className="mt-0.5 text-xs text-gray-600">
                  استكشف جميع المزايا بدون أي دفع — تجربة لمرة واحدة لكل مستخدم.
                </div>
              </div>
            </div>
            <TrialStartButton
              allowedTier={trialPolicy.allowedTier || ''}
              durationDays={trialPolicy.durationDays}
            />
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8 rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-8 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A84C] text-2xl font-bold text-[#1B3A6B]">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <div className="text-sm text-gray-300">مرحباً بك في المجلس،</div>
                <h1 className="text-2xl font-bold md:text-3xl">{user.name}</h1>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                tier === 'GOLD'
                  ? 'bg-[#C9A84C] text-[#1B3A6B]'
                  : 'bg-white/10 text-white ring-1 ring-white/20'
              }`}
            >
              <Crown className="h-4 w-4" />
              {tierMeta.nameAr}
            </div>
          </div>
        </div>

        {/* ADMIN quick-access banner — visible ONLY for admins */}
        {user.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="group mb-8 flex items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 border-red-500/30 bg-gradient-to-l from-red-600 via-red-500 to-rose-500 p-5 text-white shadow-lg transition hover:shadow-xl hover:brightness-110"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur ring-2 ring-white/30">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-extrabold md:text-lg">
                  لوحة التحكّم الإدارية
                </div>
                <div className="text-xs opacity-95">
                  إدارة المستخدمين، الإعدادات، المدفوعات، والمزيد
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-white/30 transition group-hover:bg-white/25">
              دخول
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            </div>
          </Link>
        )}

        {/* Membership card */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-gradient-to-bl from-[#F8F9FA] to-white px-6 py-4">
            <div className="flex items-center gap-2 text-[#1B3A6B]">
              <Sparkles className="h-5 w-5 text-[#C9A84C]" />
              <h2 className="text-lg font-bold">عضويتي</h2>
            </div>
            <Link
              href="/membership"
              className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#1B3A6B] transition hover:bg-[#b89440]"
            >
              <Crown className="h-4 w-4" />
              {tier === 'FREE' ? 'رقِّ عضويتك' : 'إدارة العضوية'}
            </Link>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-3">
            <InfoStat
              icon={Crown}
              label="باقة العضوية"
              value={
                <span
                  className={`inline-flex rounded-full px-3 py-0.5 text-sm font-semibold ${TIER_COLORS[tier]}`}
                >
                  {tierMeta.nameAr}
                </span>
              }
            />
            <InfoStat
              icon={CalendarClock}
              label="تاريخ الانتهاء"
              value={
                tier === 'FREE' ? (
                  <span className="text-gray-500">باقة دائمة</span>
                ) : expiry ? (
                  <div>
                    <div className="text-sm font-semibold text-[#1B3A6B]">
                      {expiry}
                    </div>
                    {daysLeft !== null && (
                      <div className="mt-0.5 text-xs text-gray-500">
                        متبقي {daysLeft} يوم
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500">-</span>
                )
              }
            />
            <InfoStat
              icon={Percent}
              label="خصم الأعضاء"
              value={
                discount > 0 ? (
                  <span className="text-sm font-bold text-green-600">
                    {discount}% على المشتريات
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">لا يوجد</span>
                )
              }
            />
          </div>

          {/* Progress bar if paid tier */}
          {tier !== 'FREE' && daysLeft !== null && (
            <div className="border-t border-gray-100 px-6 py-4">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>المدة المتبقية</span>
                <span>{daysLeft} / 365 يوم</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#C9A84C] to-[#1B3A6B] transition-all"
                  style={{
                    width: `${Math.min(100, (daysLeft / 365) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={UserIcon} label="الاسم" value={user.name} />
          <InfoCard
            icon={Mail}
            label="البريد الإلكتروني"
            value={user.email}
            ltr
          />
          <InfoCard
            icon={Shield}
            label="الدور"
            value={
              <span className="inline-flex rounded-full bg-[#1B3A6B]/10 px-3 py-0.5 text-sm font-semibold text-[#1B3A6B]">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            }
          />
        </div>

        {/* Push notifications toggle */}
        <div className="mt-8">
          <PushToggleButton />
        </div>

        {/* Quick links */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <StoreQuickAction state={vendorState} />
          <QuickAction
            href="/consultations/my-bookings"
            title="استشاراتي المحجوزة"
            desc="عرض جلسات الاستشارات القادمة والسابقة"
          />
          <QuickAction
            href="/consultations/become-expert"
            title="انضم كخبير استشاري"
            desc="قدّم استشاراتك لأعضاء المجلس (ذهبي فأعلى)"
          />
          <QuickAction
            href="/directory/my-companies"
            title="شركاتي في الدليل"
            desc="إدارة شركاتك ومتابعة حالة الاعتماد"
          />
          <QuickAction
            href="/membership"
            title="إدارة العضوية"
            desc="ترقية الباقة أو تجديد الاشتراك"
          />
        </div>
      </div>
    </div>
  )
}

function InfoStat({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div>{value}</div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, ltr = false }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div
        className={`text-base font-semibold text-[#1B3A6B] ${
          ltr ? 'text-right' : ''
        }`}
        {...(ltr ? { dir: 'ltr', style: { textAlign: 'right' } } : {})}
      >
        {value}
      </div>
    </div>
  )
}

function QuickAction({ href, title, desc }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition hover:border-[#C9A84C] hover:shadow-md"
    >
      <div>
        <div className="font-bold text-[#1B3A6B]">{title}</div>
        <div className="mt-1 text-xs text-gray-500">{desc}</div>
      </div>
      <ArrowLeft className="h-5 w-5 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-[#C9A84C]" />
    </Link>
  )
}

/**
 * "Create Store / My Store" quick-action card — contextual to the current
 * user's role, tier and pending vendor application (mirrors /dashboard/vendor).
 */
function StoreQuickAction({ state }) {
  const map = {
    ACTIVE: {
      title: 'متجري',
      desc: 'إدارة المنتجات، الطلبات، والأرصدة',
      badge: { text: 'نشِط', className: 'bg-green-100 text-green-700' },
      icon: Store,
      iconClass: 'text-green-600',
    },
    PENDING: {
      title: 'طلب متجرك قيد المراجعة',
      desc: 'سنشعرك فور اعتماد طلب فتح المتجر',
      badge: { text: 'قيد المراجعة', className: 'bg-amber-100 text-amber-800' },
      icon: Hourglass,
      iconClass: 'text-amber-600',
    },
    REJECTED: {
      title: 'أعد تقديم طلب المتجر',
      desc: 'تم رفض طلبك السابق — عدّل البيانات وحاول مجدداً',
      badge: { text: 'مرفوض', className: 'bg-red-100 text-red-700' },
      icon: XCircle,
      iconClass: 'text-red-500',
    },
    CAN_APPLY: {
      title: 'افتح متجرك الآن',
      desc: 'اعرض منتجاتك في المتجر الإلكتروني لأعضاء المجلس',
      badge: { text: 'جديد', className: 'bg-[#C9A84C]/20 text-[#8a6f2d]' },
      icon: Store,
      iconClass: 'text-[#C9A84C]',
    },
    LOCKED: {
      title: 'افتح متجرك الخاص',
      desc: 'تحتاج عضوية ذهبية أو بلاتينية لفتح متجرك',
      badge: { text: 'ذهبي فأعلى', className: 'bg-purple-100 text-purple-700' },
      icon: Lock,
      iconClass: 'text-gray-400',
    },
  }
  const m = map[state] || map.CAN_APPLY
  const Icon = m.icon
  const href = state === 'LOCKED' ? '/membership' : '/dashboard/vendor'

  return (
    <Link
      href={href}
      className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-bl from-white to-[#F8F9FA] p-5 transition hover:border-[#C9A84C] hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-100">
          <Icon className={`h-5 w-5 ${m.iconClass}`} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-bold text-[#1B3A6B]">{m.title}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.badge.className}`}>
              {m.badge.text}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">{m.desc}</div>
        </div>
      </div>
      <ArrowLeft className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:-translate-x-1 group-hover:text-[#C9A84C]" />
    </Link>
  )
}
