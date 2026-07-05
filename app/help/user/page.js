import Link from 'next/link'
import {
  BookOpen,
  UserPlus,
  Crown,
  ShoppingBag,
  GraduationCap,
  Building2,
  Store,
  Bell,
  Globe,
  ArrowRight,
  Sparkles,
  Star,
  Heart,
  Package,
  MessageCircle,
} from 'lucide-react'

export const metadata = {
  title: 'دليل المستخدم | مجلس رواد الأعمال العماني',
  description: 'دليل شامل للاستفادة من منصة مجلس رواد الأعمال العماني',
}

const SECTIONS = [
  { id: 'start', label: 'البدء السريع', icon: Sparkles },
  { id: 'account', label: 'إنشاء حساب', icon: UserPlus },
  { id: 'membership', label: 'باقات العضوية', icon: Crown },
  { id: 'store', label: 'التسوّق', icon: ShoppingBag },
  { id: 'consultations', label: 'الاستشارات', icon: GraduationCap },
  { id: 'directory', label: 'دليل الشركات', icon: Building2 },
  { id: 'vendor', label: 'فتح متجر', icon: Store },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'language', label: 'اللغة', icon: Globe },
]

export default function UserGuidePage() {
  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1B3A6B]/10">
            <BookOpen className="h-7 w-7 text-[#1B3A6B]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1B3A6B] md:text-4xl">
            📘 دليل المستخدم
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-gray-600">
            كل ما تحتاج لمعرفته للاستفادة الكاملة من منصة مجلس رواد الأعمال العماني
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sticky TOC */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-xs font-bold text-[#1B3A6B]">المحتويات</div>
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 transition hover:bg-[#F8F9FA] hover:text-[#1B3A6B]"
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <main className="space-y-10 text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1B3A6B] [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#1B3A6B] [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pr-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pr-6">
            {/* Start */}
            <Section id="start" icon={Sparkles} title="🚀 البدء السريع">
              <p>ابدأ خلال 3 دقائق:</p>
              <ol>
                <li>اذهب إلى <Link href="/" className="text-[#1B3A6B] font-semibold underline">الصفحة الرئيسية</Link></li>
                <li>اضغط <b>&quot;انضم الآن&quot;</b> وأنشئ حساباً مجانياً</li>
                <li>ابدأ بتصفّح المتجر، الاستشارات، أو دليل الشركات</li>
              </ol>
              <p className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                💡 لست بحاجة لحساب لتصفّح المنتجات — لكن ستحتاجه للشراء والحجز.
              </p>
            </Section>

            {/* Account */}
            <Section id="account" icon={UserPlus} title="🔐 إنشاء حساب وتسجيل الدخول">
              <h3>إنشاء حساب</h3>
              <ol>
                <li>اضغط <Link href="/signup" className="text-[#1B3A6B] underline">انضم الآن</Link></li>
                <li>أدخل الاسم، البريد، وكلمة مرور (6 أحرف+)</li>
                <li>سيتم تسجيل دخولك تلقائياً + بريد ترحيب</li>
              </ol>
              <h3>تسجيل الدخول</h3>
              <p>من <Link href="/login" className="text-[#1B3A6B] underline">/login</Link>. نسيت كلمة المرور؟ اضغط الرابط في نفس الصفحة.</p>
            </Section>

            {/* Membership */}
            <Section id="membership" icon={Crown} title="💎 باقات العضوية">
              <p>4 باقات لتناسب احتياجات كل رائد أعمال. تنتهي بعد 12 شهراً — لا تجديد تلقائي.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <TierCard tier="🆓 مجاني" price="0 ر.ع" perks={['تصفّح الدليل', 'حضور الفعاليات العامة']} />
                <TierCard tier="🔵 أساسي" price="50 ر.ع" perks={['إدراج شركتك', 'خصم 10% على المتجر والاستشارات']} />
                <TierCard tier="🥇 ذهبي" price="100 ر.ع" popular perks={['فتح متجر بائع', 'خصم 20%', 'شركة مميّزة']} />
                <TierCard tier="💎 بلاتيني" price="200 ر.ع" perks={['جلسة مجانية شهرياً', 'خصم 30%', 'دعم مخصّص']} />
              </div>
              <p className="mt-3">📍 اذهب إلى <Link href="/membership" className="text-[#1B3A6B] underline font-semibold">/membership</Link> للاشتراك.</p>
            </Section>

            {/* Store */}
            <Section id="store" icon={ShoppingBag} title="🛒 التسوّق من المتجر">
              <h3>🔍 البحث الذكي (AI)</h3>
              <p>جرّب: <i>&quot;أحذية رياضية رخيصة للشتاء بتقييم 4 نجوم&quot;</i> — النظام يفهم لغتك الطبيعية.</p>
              <h3>الفلاتر المتقدمة</h3>
              <ul>
                <li>💰 نطاق السعر</li>
                <li>⭐ التقييم (3+ / 4+)</li>
                <li>🚚 شحن مجاني (فوق 30 ر.ع)</li>
                <li>🏷️ العلامات الشائعة</li>
              </ul>
              <h3>💳 الدفع الآمن</h3>
              <p>عبر <b>Thawani Pay</b> — مرخّص من البنك المركزي العُماني ومعتمد PCI-DSS. لا نُخزّن بيانات البطاقات.</p>
              <h3>❤️ قائمة المفضلة</h3>
              <p>اضغط أيقونة القلب لحفظ منتج، وشاهد قائمتك من <Link href="/store/wishlist" className="text-[#1B3A6B] underline">/store/wishlist</Link>.</p>
              <h3>⭐ التقييم والمراجعات</h3>
              <p>بعد الاستلام، قيّم المنتج (1-5 نجوم) واكتب مراجعة نصية. التقييمات موثّقة — فقط من اشترى فعلاً.</p>
            </Section>

            {/* Consultations */}
            <Section id="consultations" icon={GraduationCap} title="🎓 حجز استشارة">
              <p>تصفّح الخبراء من <Link href="/consultations" className="text-[#1B3A6B] underline">/consultations</Link>.</p>
              <h3>📅 سياسة الإلغاء</h3>
              <ul>
                <li>قبل 24 ساعة+ → استرداد كامل 100% ✅</li>
                <li>قبل 6-24 ساعة → استرداد 50%</li>
                <li>أقل من 6 ساعات أو عدم حضور → لا استرداد ❌</li>
                <li>إلغاء من الخبير → استرداد كامل فوري ✅</li>
              </ul>
            </Section>

            {/* Directory */}
            <Section id="directory" icon={Building2} title="🏢 دليل الشركات">
              <p>3 أوضاع عرض: 📋 قائمة، 🗺️ خريطة، 🎨 مختلط. فلترة حسب القطاع والمحافظة.</p>
              <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                ⚠️ للزوار: نعرض 5 شركات فقط من كل قطاع. اشترك بالعضوية الأساسية+ لرؤية الدليل كاملاً.
              </p>
              <p className="mt-3">أضف شركتك من <Link href="/directory/add-company" className="text-[#1B3A6B] underline">/directory/add-company</Link> (يتطلّب عضوية أساسية+).</p>
            </Section>

            {/* Vendor */}
            <Section id="vendor" icon={Store} title="🏪 للتجار — فتح متجر">
              <p>متاح فقط للأعضاء <b>الذهبيين</b> و<b>البلاتينيين</b>.</p>
              <ol>
                <li>اذهب إلى <Link href="/store/vendor" className="text-[#1B3A6B] underline">/store/vendor</Link></li>
                <li>سجّل كبائع (اسم المتجر، القطاع، الحساب البنكي)</li>
                <li>ينتظر موافقة الأدمن (24-48 ساعة)</li>
                <li>بعد الموافقة، أضف منتجاتك من لوحة التحكم</li>
              </ol>
              <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm">
                ⏰ يجب تجهيز أي طلب خلال 3 أيام عمل كحد أقصى.
              </p>
            </Section>

            {/* Notifications */}
            <Section id="notifications" icon={Bell} title="🔔 الإشعارات وتثبيت التطبيق">
              <h3>تفعيل الإشعارات</h3>
              <p>من <Link href="/dashboard" className="text-[#1B3A6B] underline">/dashboard</Link> ستجد قسم &quot;فعّل الإشعارات&quot; — اضغطه واسمح للمتصفح.</p>
              <p>ستستقبل: تحديثات الطلبات، تذكيرات الجلسات، العروض الحصرية.</p>
              <h3>📱 تثبيت التطبيق (PWA)</h3>
              <p><b>Android/Chrome:</b> ستظهر رسالة &quot;تثبيت التطبيق&quot; — اضغطها.</p>
              <p><b>iPhone/Safari:</b> اضغط زر المشاركة ⬆️ ← &quot;إضافة إلى الشاشة الرئيسية&quot;.</p>
            </Section>

            {/* Language */}
            <Section id="language" icon={Globe} title="🌐 العربية / English">
              <p>في أعلى الصفحة زر &quot;English&quot; يحوّل الموقع للإنجليزية (LTR). للعودة اضغط &quot;العربية&quot; (RTL). الاختيار يُحفظ للزيارات القادمة.</p>
            </Section>

            {/* FAQ */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5" /> الأسئلة الشائعة
              </h2>
              <div className="space-y-4 text-sm">
                <FAQ q="كيف أُلغي اشتراكي؟" a="اشتراكاتنا يدوية بالكامل — تنتهي تلقائياً بعد سنة، لست بحاجة لإلغاء شيء." />
                <FAQ q="هل تشحنون خارج عُمان؟" a="حالياً داخل السلطنة فقط. الخليج قيد التطوير." />
                <FAQ q="مدة التوصيل؟" a="مسقط: 2-4 أيام. باقي المحافظات: 3-7 أيام. المناطق النائية: 5-9 أيام." />
                <FAQ q="طرق الدفع؟" a="البطاقات البنكية الخليجية + فيزا/ماستركارد عبر Thawani Pay." />
              </div>
            </div>

            {/* Contact */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1B3A6B] to-[#152c52] p-6 text-white">
              <h2 className="mb-3 text-white">📞 تواصل معنا</h2>
              <ul className="space-y-1 text-sm">
                <li>📧 <a href="mailto:support@omanimajles.com" className="underline">support@omanimajles.com</a></li>
                <li>💬 زر واتساب العائم في أسفل الشاشة</li>
                <li>🕐 الأحد–الخميس، 8ص–6م</li>
              </ul>
            </div>

            {/* Legal links */}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/terms" className="text-[#1B3A6B] underline">الشروط والأحكام</Link>
              <Link href="/privacy" className="text-[#1B3A6B] underline">سياسة الخصوصية</Link>
              <Link href="/refund" className="text-[#1B3A6B] underline">سياسة الاسترداد</Link>
              <Link href="/shipping" className="text-[#1B3A6B] underline">سياسة الشحن</Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function Section({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5" /> {title}
      </h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  )
}

function TierCard({ tier, price, perks, popular }) {
  return (
    <div className={`rounded-xl border-2 p-3 ${popular ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <div className="font-bold text-[#1B3A6B]">{tier}</div>
        <div className="text-xs font-bold text-[#C9A84C]">{price}</div>
      </div>
      <ul className="mt-2 space-y-1 text-[11px] text-gray-600">
        {perks.map((p) => (
          <li key={p}>✓ {p}</li>
        ))}
      </ul>
    </div>
  )
}

function FAQ({ q, a }) {
  return (
    <div>
      <div className="font-bold text-[#1B3A6B]">❓ {q}</div>
      <div className="mt-1 text-gray-600">{a}</div>
    </div>
  )
}
