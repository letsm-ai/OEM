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
  Bell,
  BookOpen,
  Lock,
  AlertTriangle,
  Clock,
  Calendar,
  Target,
} from 'lucide-react'

export const metadata = {
  title: 'دليل الأدمن | مجلس رواد الأعمال العماني',
  description: 'دليل شامل لإدارة منصة مجلس رواد الأعمال العماني',
}

export const dynamic = 'force-dynamic'

const TOC = [
  { id: 'access', label: 'الوصول والصلاحيات', icon: Lock },
  { id: 'analytics', label: 'الإحصائيات', icon: BarChart3 },
  { id: 'users', label: 'المستخدمين', icon: Users },
  { id: 'approvals', label: 'الموافقات', icon: CheckCircle2 },
  { id: 'revenue', label: 'الإيرادات', icon: Wallet },
  { id: 'vendors', label: 'البائعين', icon: Store },
  { id: 'payouts', label: 'المدفوعات', icon: Wallet },
  { id: 'coupons', label: 'الكوبونات', icon: Tag },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'routines', label: 'الروتين اليومي', icon: Clock },
  { id: 'security', label: 'الأمان', icon: Shield },
]

export default async function AdminGuidePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/help/admin')
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-[#1B3A6B]">غير مصرح</h1>
        <p className="mt-2 text-sm text-gray-600">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <BookOpen className="h-7 w-7 text-red-700" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
            🛡️ دليل الأدمن
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-gray-600">
            دليل شامل لإدارة منصة مجلس رواد الأعمال العماني بكفاءة وأمان
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
            <Lock className="h-3 w-3" /> صفحة مقيّدة — للمسؤولين فقط
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sticky TOC */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-xs font-bold text-[#1B3A6B]">المحتويات</div>
              <ul className="space-y-0.5">
                {TOC.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 transition hover:bg-[#F8F9FA] hover:text-[#1B3A6B]">
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
              <hr className="my-3 border-gray-100" />
              <Link href="/admin" className="block rounded-md bg-[#1B3A6B] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#152c52]">
                ← لوحة الإدارة
              </Link>
            </div>
          </aside>

          <main className="space-y-6 text-gray-700 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-bold [&_h3]:text-[#1B3A6B] [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pr-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pr-6">
            {/* Access */}
            <AdminSection id="access" icon={Lock} title="🔑 الوصول والصلاحيات">
              <h3>كيف تصبح أدمن؟</h3>
              <p>يقوم مسؤول موجود بترقيتك من <Link href="/admin/users" className="text-[#1B3A6B] underline">/admin/users</Link> بتغيير دورك إلى <code>ADMIN</code>.</p>
              <h3>أدوار المنصة</h3>
              <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                <RoleTag role="USER" desc="مستخدم عادي (شراء، حجز)" />
                <RoleTag role="VENDOR" desc="بائع (يفتح متجر)" />
                <RoleTag role="EXPERT" desc="خبير (يقدّم استشارات)" />
                <RoleTag role="ADMIN" desc="إدارة كاملة ⭐" tone="red" />
              </div>
              <p className="mt-2 text-xs text-gray-500">💡 يمكن للمستخدم الواحد أن يجمع أكثر من دور.</p>
            </AdminSection>

            {/* Analytics */}
            <AdminSection id="analytics" icon={BarChart3} title="📊 الإحصائيات">
              <p className="text-sm">🔗 <Link href="/admin/analytics" className="text-[#1B3A6B] underline font-semibold">/admin/analytics</Link></p>
              <h3>KPIs الرئيسية</h3>
              <ul>
                <li>👥 المستخدمين حسب الدور</li>
                <li>💎 المشتركين النشطين حسب الباقة</li>
                <li>🛒 الطلبات (يومي/شهري)</li>
                <li>💰 الإيرادات (متجر / عضويات / استشارات)</li>
                <li>⭐ متوسط تقييمات المنتجات والخبراء</li>
              </ul>
              <p className="mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs">
                💡 راجع هذه الصفحة أسبوعياً لمتابعة صحة المنصة.
              </p>
            </AdminSection>

            {/* Users */}
            <AdminSection id="users" icon={Users} title="👥 إدارة المستخدمين">
              <p className="text-sm">🔗 <Link href="/admin/users" className="text-[#1B3A6B] underline font-semibold">/admin/users</Link></p>
              <h3>الوظائف</h3>
              <ul>
                <li>🔍 بحث بالاسم أو البريد</li>
                <li>🎭 تغيير الدور</li>
                <li>⛔ تعليق (Suspend) / ✅ إلغاء التعليق</li>
                <li>📊 عرض تفاصيل النشاط</li>
              </ul>
              <h3>متى تُعلّق حساباً؟</h3>
              <ul>
                <li>مخالفات متكررة لشروط الاستخدام</li>
                <li>محتوى غير لائق</li>
                <li>محاولات احتيال</li>
                <li>انتحال شخصية</li>
              </ul>
              <p className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                ⚠️ قبل التعليق: أرسل تحذيراً كتابياً، وثّق السبب، تواصل مع البائع/الخبير النشط.
              </p>
            </AdminSection>

            {/* Approvals */}
            <AdminSection id="approvals" icon={CheckCircle2} title="✅ مركز الموافقات">
              <p className="text-sm">🔗 <Link href="/admin/approvals" className="text-[#1B3A6B] underline font-semibold">/admin/approvals</Link></p>
              <h3>🏢 موافقات الشركات</h3>
              <p>راجع: الاسم، القطاع، الوصف، الشعار. تحقّق من عدم وجود أخطاء إملائية.</p>
              <h3>🎓 موافقات الخبراء</h3>
              <p>راجع: السيرة الذاتية، الشهادات، التخصص، سعر الساعة. يمكنك طلب مقابلة قبل الموافقة.</p>
              <h3>🏪 موافقات البائعين</h3>
              <p>راجع: نوع النشاط، الحساب البنكي، ملكية الحساب.</p>
            </AdminSection>

            {/* Revenue */}
            <AdminSection id="revenue" icon={Wallet} title="💰 تقرير الإيرادات">
              <p className="text-sm">🔗 <Link href="/admin/revenue" className="text-[#1B3A6B] underline font-semibold">/admin/revenue</Link></p>
              <h3>التقسيمات</h3>
              <ul>
                <li>📅 يومي / أسبوعي / شهري / سنوي</li>
                <li>💰 حسب المصدر: عضويات، متجر، استشارات</li>
                <li>🏭 حسب القطاع والبائع</li>
              </ul>
              <p className="mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs">
                💡 صدّر تقرير CSV/PDF شهرياً واحتفظ بنسخة آمنة.
              </p>
            </AdminSection>

            {/* Vendors */}
            <AdminSection id="vendors" icon={Store} title="🏪 طلبات البائعين">
              <p className="text-sm">🔗 <Link href="/admin/vendor-applications" className="text-[#1B3A6B] underline font-semibold">/admin/vendor-applications</Link></p>
              <h3>خطوات المراجعة</h3>
              <ol>
                <li>تحقّق من هوية الشخص</li>
                <li>راجع نوع المنتجات (قانونية؟)</li>
                <li>تحقّق من الحساب البنكي</li>
                <li>موافقة / رفض مع سبب</li>
              </ol>
              <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> ممنوعات صارمة — يجب الرفض
                </div>
                <ul className="text-xs text-red-800">
                  <li>❌ منتجات مقلّدة</li>
                  <li>❌ كحول أو مخدرات</li>
                  <li>❌ أسلحة أو ذخائر</li>
                  <li>❌ منتجات طبية بدون ترخيص</li>
                  <li>❌ محتوى غير لائق</li>
                  <li>❌ عملات مشفّرة / استثمارات وهمية</li>
                </ul>
              </div>
            </AdminSection>

            {/* Payouts */}
            <AdminSection id="payouts" icon={Wallet} title="💸 المدفوعات (Payouts)">
              <p className="text-sm">🔗 <Link href="/admin/payouts" className="text-[#1B3A6B] underline font-semibold">/admin/payouts</Link></p>
              <h3>دورة الدفع الشهرية</h3>
              <ul>
                <li>يوم 1: حساب أرصدة البائعين</li>
                <li>يوم 5: البائعون يقدّمون طلبات سحب</li>
                <li>يوم 10: الأدمن يراجع</li>
                <li>يوم 15: يتم التحويل البنكي</li>
              </ul>
              <p className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                ⚠️ للمبالغ &gt; 500 ر.ع: تحقّق مع البائع هاتفياً قبل التحويل.
              </p>
              <p className="mt-2">بعد التحويل: حدّث الحالة إلى <b>PAID</b> وأرفق رقم مرجع التحويل.</p>
            </AdminSection>

            {/* Coupons */}
            <AdminSection id="coupons" icon={Tag} title="🎟️ الكوبونات">
              <p className="text-sm">🔗 <Link href="/admin/coupons" className="text-[#1B3A6B] underline font-semibold">/admin/coupons</Link></p>
              <h3>أنواع الحملات المقترحة</h3>
              <ul>
                <li>🎉 <b>مواسم:</b> <code>EID20</code>, <code>NATIONAL15</code>, <code>RAMADAN10</code></li>
                <li>👋 <b>ترحيبية:</b> <code>WELCOME10</code> لأول 1000 مستخدم</li>
                <li>🎯 <b>مستهدفة:</b> <code>GOLD5</code> لأعضاء ذهبيين</li>
                <li>🔥 <b>حدود:</b> <code>FIRST50</code> لأول 50 مشتري</li>
              </ul>
            </AdminSection>

            {/* Notifications */}
            <AdminSection id="notifications" icon={Bell} title="🔔 إشعارات Push الجماعية">
              <p className="text-sm">🔗 <Link href="/admin/notifications" className="text-[#1B3A6B] underline font-semibold">/admin/notifications</Link></p>
              <h3>📋 قواعد ذهبية</h3>
              <ul>
                <li>✅ مرتين في الأسبوع كحد أقصى</li>
                <li>✅ عناوين واضحة مع رموز إيموجي</li>
                <li>✅ اختبر أولاً بإرسال لنفسك</li>
                <li>✅ استهدف اللغة الصحيحة (ar/en/all)</li>
                <li>✅ اربط برابط ذي صلة (مثل <code>/store</code>)</li>
              </ul>
              <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> تجنّب هذه الأخطاء
                </div>
                <ul className="text-xs text-red-800">
                  <li>❌ رسائل مكرّرة</li>
                  <li>❌ إشعارات بعد منتصف الليل</li>
                  <li>❌ خصومات مبالغ فيها (&quot;90%!&quot;)</li>
                  <li>❌ روابط لا تفتح صفحة مفيدة</li>
                </ul>
              </div>
            </AdminSection>

            {/* Routines */}
            <AdminSection id="routines" icon={Calendar} title="🏆 الروتين المُوصى">
              <h3>⏰ يومي (10 دقائق)</h3>
              <ul>
                <li>راجع <Link href="/admin/approvals" className="text-[#1B3A6B] underline">مركز الموافقات</Link></li>
                <li>تفقّد الطلبات الجديدة في التحليلات</li>
                <li>راجع الشكاوى في البريد</li>
              </ul>
              <h3>📅 أسبوعي (30 دقيقة)</h3>
              <ul>
                <li>عالج طلبات السحب</li>
                <li>راجع التقييمات المتدنية</li>
                <li>أطلق كوبون / إشعار جماعي</li>
              </ul>
              <h3>📆 شهري (2 ساعة)</h3>
              <ul>
                <li>صدّر تقرير الإيرادات</li>
                <li>نظّف الشركات الخاملة</li>
                <li>راجع اتفاقيات الخبراء والبائعين</li>
              </ul>
              <h3 className="mt-4">🎯 KPIs مستهدفة</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Kpi label="نمو المستخدمين الشهري" value="+15%" />
                <Kpi label="تحويل زائر → عضو" value="5%+" />
                <Kpi label="تحويل عضو → مدفوع" value="3%+" />
                <Kpi label="متوسط قيمة الطلب" value="25+ ر.ع" />
              </div>
            </AdminSection>

            {/* Security */}
            <AdminSection id="security" icon={Shield} title="🔒 الأمان والخصوصية">
              <h3>🛡️ قواعد صارمة</h3>
              <ul>
                <li>❌ لا مشاركة بيانات المستخدمين — قانون حماية البيانات العُماني 2022</li>
                <li>❌ لا تخزين خارج المنصة (ممنوع Excel/Sheets محلية)</li>
                <li>✅ كلمة مرور قوية (12+ حرف + رموز)</li>
                <li>✅ لا تسجّل الدخول من أجهزة عامة</li>
              </ul>
              <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> حالات الطوارئ
                </div>
                <ul className="text-xs text-red-800">
                  <li>🚨 اختراق أمني → أوقف الخدمة + تواصل مع Emergent</li>
                  <li>🚨 تسريب بيانات → أبلغ المتأثرين خلال 72 ساعة (قانون)</li>
                  <li>🚨 احتيال كبير → أوقف الحساب + بلّغ الشرطة العُمانية (999)</li>
                </ul>
              </div>
            </AdminSection>

            <div className="rounded-2xl bg-gradient-to-br from-[#1B3A6B] to-[#152c52] p-6 text-center text-white">
              <div className="mb-2 text-2xl">🎉</div>
              <p className="font-semibold">شكراً لإدارتك المنصة بمهنية!</p>
              <p className="mt-2 text-xs text-white/80">إصدار الأدمن — يوليو 2026</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function AdminSection({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#1B3A6B]">
        <Icon className="h-5 w-5" /> {title}
      </h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  )
}

function RoleTag({ role, desc, tone }) {
  const cls = tone === 'red'
    ? 'border-red-300 bg-red-50 text-red-800'
    : 'border-gray-200 bg-gray-50 text-gray-700'
  return (
    <div className={`rounded-lg border ${cls} px-3 py-2`}>
      <div className="font-bold">{role}</div>
      <div className="text-[11px]">{desc}</div>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-600">{label}</div>
      <div className="text-lg font-bold text-[#1B3A6B]">{value}</div>
    </div>
  )
}
