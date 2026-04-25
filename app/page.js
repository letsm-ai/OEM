import Link from 'next/link'
import {
  ShoppingBag,
  Users,
  Briefcase,
  GraduationCap,
  ArrowLeft,
  Shield,
  TrendingUp,
  Star,
  Building2,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { connectDB } from '@/lib/db'
import { Product, Expert, Company } from '@/lib/models'
import { TIER_META } from '@/lib/membership'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getLandingData() {
  try {
    await connectDB()
    const [products, experts, companies] = await Promise.all([
      Product.find({ isActive: true })
        .sort({ rating: -1, salesCount: -1 })
        .limit(6)
        .lean(),
      Expert.find({ status: 'APPROVED' })
        .sort({ rating: -1, totalSessions: -1 })
        .limit(4)
        .lean(),
      Company.find({ status: 'APPROVED' })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ])
    return {
      products: products.map((p) => ({ id: p._id, ...p, _id: undefined })),
      experts: experts.map((e) => ({ id: e._id, ...e, _id: undefined })),
      companies: companies.map((c) => ({ id: c._id, ...c, _id: undefined })),
    }
  } catch {
    return { products: [], experts: [], companies: [] }
  }
}

export default async function LandingPage() {
  const { products, experts, companies } = await getLandingData()
  return (
    <div className="bg-[#F8F9FA]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-[#1B3A6B] via-[#1B3A6B] to-[#152c52] text-white">
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
          <h2 className="mb-3 text-3xl font-bold text-[#1B3A6B] md:text-4xl">كل ما يحتاجه رائد الأعمال</h2>
          <p className="mx-auto max-w-xl text-gray-600">خدمات متكاملة تساعدك على النمو والتشبيك والوصول لأسواق جديدة</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShoppingBag, title: 'المتجر', desc: 'اعرض منتجاتك وبع مباشرة لأعضاء المجلس', href: '/store' },
            { icon: GraduationCap, title: 'الاستشارات', desc: 'احجز جلسات مع خبراء متخصصين في مجالك', href: '/consultations' },
            { icon: Briefcase, title: 'دليل الشركات', desc: 'تعرّف على شركات رواد الأعمال العمانيين', href: '/directory' },
            { icon: Users, title: 'العضويات', desc: 'باقات عضوية متدرجة تفتح لك مزايا حصرية', href: '/membership' },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#C9A84C] hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#1B3A6B]/5 text-[#1B3A6B] transition group-hover:bg-[#C9A84C] group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#1B3A6B]">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {products.length > 0 && (
        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#C9A84C]/10 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" /> منتجات مميّزة
                </div>
                <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">الأكثر مبيعاً وتقييماً</h2>
                <p className="mt-1 text-sm text-gray-500">منتجات مختارة من تجارنا المعتمدين</p>
              </div>
              <Link href="/store" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
                عرض الكل <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {products.map((p) => (
                <Link key={p.id} href={`/store/${p.id}`} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex h-32 items-center justify-center bg-gradient-to-bl from-gray-50 to-gray-100 text-4xl">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.nameAr || p.nameEn} className="h-full w-full object-cover" />
                    ) : (
                      '🛍️'
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-bold text-[#1B3A6B] group-hover:text-[#C9A84C]">{p.nameAr || p.nameEn}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-[#C9A84C]">{(p.price || 0).toFixed(2)} ر.ع</span>
                      {p.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500">
                          <Star className="h-3 w-3 fill-[#C9A84C] text-[#C9A84C]" />
                          {p.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TOP EXPERTS */}
      {experts.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                <GraduationCap className="h-3.5 w-3.5" /> أفضل الخبراء
              </div>
              <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">احجز استشارتك اليوم</h2>
              <p className="mt-1 text-sm text-gray-500">خبراء معتمدون في مختلف القطاعات</p>
            </div>
            <Link href="/consultations" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
              تصفح الخبراء <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {experts.map((e) => (
              <Link key={e.id} href={`/expert/${e.id}`} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-bl from-indigo-100 to-blue-100 text-2xl font-bold text-indigo-700">
                  {(e.name || '?').charAt(0)}
                </div>
                <div className="font-bold text-[#1B3A6B] group-hover:text-indigo-700">{e.name}</div>
                <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{e.specialtyAr || e.specialty}</div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#C9A84C]">
                    <Star className="h-3 w-3 fill-[#C9A84C]" /> {(e.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-gray-500">{e.totalSessions || 0} جلسة</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* RECENTLY JOINED COMPANIES */}
      {companies.length > 0 && (
        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                  <Building2 className="h-3.5 w-3.5" /> شركات حديثة الانضمام
                </div>
                <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">رواد الأعمال الجدد</h2>
                <p className="mt-1 text-sm text-gray-500">تعرّف على آخر الشركات المنضمة للمجلس</p>
              </div>
              <Link href="/directory" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
                دليل الشركات <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => (
                <Link key={c.id} href={`/directory/${c.id}`} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-cyan-300 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-bl from-cyan-100 to-blue-100 text-cyan-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[#1B3A6B] group-hover:text-cyan-700 line-clamp-1">{c.nameAr || c.nameEn}</div>
                      {c.industry && <div className="mt-0.5 text-xs text-gray-500">{c.industry}</div>}
                      {c.governorate && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <MapPin className="h-3 w-3" /> {c.governorate}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VALUE PROPS */}
      <section className="bg-[#F8F9FA] py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-[#1B3A6B] md:text-4xl">لماذا مجلس رواد الأعمال العماني؟</h2>
              <p className="mb-8 text-gray-600 leading-relaxed">
                نحن نؤمن أن رواد الأعمال العمانيين يستحقون منصة وطنية تجمعهم، تدعمهم، وتفتح لهم أبواب الفرص المحلية والإقليمية.
              </p>
              <div className="space-y-5">
                {[
                  { icon: Shield, title: 'موثوقية عالية', desc: 'جميع الشركات والخبراء يمرّون بعملية تحقق واعتماد' },
                  { icon: TrendingUp, title: 'فرص نمو حقيقية', desc: 'وصول مباشر لعملاء وشركاء وخبراء من خلال المنصة' },
                  { icon: Users, title: 'مجتمع فاعل', desc: 'شبكة من رواد الأعمال العمانيين في قطاعات متنوعة' },
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
                <div className="mb-6 text-sm font-medium text-[#C9A84C]">مستوى العضوية</div>
                <div className="space-y-3">
                  {(['FREE', 'BASIC', 'GOLD', 'PLATINUM']).map((key) => {
                    const t = TIER_META[key]
                    const isHighlighted = key === 'GOLD'
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between rounded-lg ${isHighlighted ? 'bg-[#C9A84C]/20 border border-[#C9A84C]/50' : 'bg-white/10'} px-4 py-3`}
                      >
                        <span className="font-semibold">{t.nameAr}</span>
                        <span className="text-sm">
                          <span className="text-lg font-bold text-[#C9A84C]">{t.price}</span> ر.ع / شهرياً
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Link href="/signup" className="mt-6 block w-full rounded-lg bg-[#C9A84C] py-3 text-center font-semibold text-[#1B3A6B] transition hover:bg-[#b89440]">
                  ابدأ بالعضوية المجانية
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JOIN CTA */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-[#1B3A6B] via-[#152c52] to-[#0f2348] text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 50%, #C9A84C 0%, transparent 50%), radial-gradient(circle at 70% 50%, #C9A84C 0%, transparent 50%)',
          }}
        />
        <div className="relative container mx-auto px-4 py-16 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-[#C9A84C]" />
          <h2 className="mb-4 text-3xl font-extrabold md:text-4xl">انضم إلى المجلس اليوم</h2>
          <p className="mx-auto mb-8 max-w-2xl text-gray-200">
            ابدأ رحلتك مع شبكة رواد الأعمال العمانيين — تواصل، تعلّم، نَمِّ أعمالك، وكن جزءاً من نهضة الاقتصاد الوطني.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-6 py-3 text-base font-bold text-[#1B3A6B] shadow-lg transition hover:bg-[#b89440]">
              إنشاء حساب مجاني <ArrowLeft className="h-5 w-5" />
            </Link>
            <Link href="/membership" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/10">
              تصفّح باقات العضوية
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
