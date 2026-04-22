import Link from 'next/link'
import {
  ShoppingBag,
  Users,
  Briefcase,
  GraduationCap,
  ArrowLeft,
  Shield,
  TrendingUp,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="bg-[#F8F9FA]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-[#1B3A6B] via-[#1B3A6B] to-[#152c52] text-white">
        {/* decorative gold pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #C9A84C 0%, transparent 40%), radial-gradient(circle at 80% 80%, #C9A84C 0%, transparent 40%)',
          }}
        />
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-1.5 text-sm text-[#E8D08C]">
              <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />
              منصة رواد الأعمال الأولى في سلطنة عُمان
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight md:text-6xl">
              مجلس رواد الأعمال
              <span className="mx-3 text-[#C9A84C]">العماني</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-200 md:text-xl">
              منظومة رواد الأعمال العمانيين — مكان واحد يجمعكم: متجر، استشارات،
              دليل شركات، وعضويات حصرية لبناء شراكات حقيقية وتوسيع أعمالكم.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-6 py-3 text-base font-semibold text-[#1B3A6B] shadow-lg transition hover:bg-[#b89440]"
              >
                انضم إلى المجلس
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                تسجيل الدخول
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 md:gap-12">
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+500</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">رائد أعمال</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+120</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">شركة مسجلة</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+50</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">خبير استشاري</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-[#1B3A6B] md:text-4xl">
            كل ما يحتاجه رائد الأعمال
          </h2>
          <p className="mx-auto max-w-xl text-gray-600">
            خدمات متكاملة تساعدك على النمو والتشبيك والوصول لأسواق جديدة
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShoppingBag,
              title: 'المتجر',
              desc: 'اعرض منتجاتك وبع مباشرة لأعضاء المجلس',
            },
            {
              icon: GraduationCap,
              title: 'الاستشارات',
              desc: 'احجز جلسات مع خبراء متخصصين في مجالك',
            },
            {
              icon: Briefcase,
              title: 'دليل الشركات',
              desc: 'تعرّف على شركات رواد الأعمال العمانيين',
            },
            {
              icon: Users,
              title: 'العضويات',
              desc: 'باقات عضوية متدرجة تفتح لك مزايا حصرية',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#C9A84C] hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#1B3A6B]/5 text-[#1B3A6B] transition group-hover:bg-[#C9A84C] group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#1B3A6B]">
                {f.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-[#1B3A6B] md:text-4xl">
                لماذا مجلس رواد الأعمال العماني؟
              </h2>
              <p className="mb-8 text-gray-600 leading-relaxed">
                نحن نؤمن أن رواد الأعمال العمانيين يستحقون منصة وطنية تجمعهم،
                تدعمهم، وتفتح لهم أبواب الفرص المحلية والإقليمية.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: Shield,
                    title: 'موثوقية عالية',
                    desc: 'جميع الشركات والخبراء يمرّون بعملية تحقق واعتماد',
                  },
                  {
                    icon: TrendingUp,
                    title: 'فرص نمو حقيقية',
                    desc: 'وصول مباشر لعملاء وشركاء وخبراء من خلال المنصة',
                  },
                  {
                    icon: Users,
                    title: 'مجتمع فاعل',
                    desc: 'شبكة من رواد الأعمال العمانيين في قطاعات متنوعة',
                  },
                ].map((v) => (
                  <div key={v.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C9A84C]/10 text-[#C9A84C]">
                      <v.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1B3A6B]">{v.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-8 text-white shadow-2xl">
                <div className="mb-6 text-sm font-medium text-[#C9A84C]">
                  مستوى العضوية
                </div>
                <div className="space-y-3">
                  {[
                    { tier: 'مجاني', price: '0', color: 'bg-white/10' },
                    { tier: 'أساسي', price: '25', color: 'bg-white/10' },
                    { tier: 'ذهبي', price: '75', color: 'bg-[#C9A84C]/20 border border-[#C9A84C]/50' },
                    { tier: 'بلاتيني', price: '150', color: 'bg-white/10' },
                  ].map((p) => (
                    <div
                      key={p.tier}
                      className={`flex items-center justify-between rounded-lg ${p.color} px-4 py-3`}
                    >
                      <span className="font-semibold">{p.tier}</span>
                      <span className="text-sm">
                        <span className="text-lg font-bold text-[#C9A84C]">
                          {p.price}
                        </span>{' '}
                        ر.ع / شهرياً
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/signup"
                  className="mt-6 block w-full rounded-lg bg-[#C9A84C] py-3 text-center font-semibold text-[#1B3A6B] transition hover:bg-[#b89440]"
                >
                  ابدأ بالعضوية المجانية
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} مجلس رواد الأعمال العماني — جميع الحقوق محفوظة
        </div>
      </footer>
    </div>
  )
}
