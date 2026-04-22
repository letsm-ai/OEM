import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { User as UserIcon, Mail, Shield, Crown, Calendar } from 'lucide-react'

const ROLE_LABELS = {
  ADMIN: 'مسؤول',
  MEMBER: 'عضو',
  VENDOR: 'بائع',
  EXPERT: 'خبير',
}

const TIER_LABELS = {
  FREE: 'مجاني',
  BASIC: 'أساسي',
  GOLD: 'ذهبي',
  PLATINUM: 'بلاتيني',
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
  const { user } = session

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Welcome */}
        <div className="mb-8 rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A84C] text-2xl font-bold text-[#1B3A6B]">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="text-sm text-gray-300">مرحباً بك في المجلس،</div>
              <h1 className="text-2xl font-bold md:text-3xl">{user.name}</h1>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            icon={UserIcon}
            label="الاسم"
            value={user.name}
          />
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
          <InfoCard
            icon={Crown}
            label="باقة العضوية"
            value={
              <span
                className={`inline-flex rounded-full px-3 py-0.5 text-sm font-semibold ${
                  TIER_COLORS[user.membershipTier] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {TIER_LABELS[user.membershipTier] || user.membershipTier}
              </span>
            }
          />
        </div>

        {/* Next steps */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-[#1B3A6B]">الخطوات التالية</h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />
              أكمل ملفك الشخصي وبيانات شركتك (قريباً)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />
              استعرض خطط العضويات واختر ما يناسبك (قريباً)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" />
              تصفح المتجر ودليل الشركات (قريباً)
            </li>
          </ul>
        </div>
      </div>
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
