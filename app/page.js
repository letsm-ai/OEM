import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
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
import { translations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/translations'

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
    console.log(
      `[landing] products=${products.length} experts=${experts.length} companies=${companies.length}`
    )
    return {
      products: products.map((p) => ({ id: p._id, ...p, _id: undefined })),
      experts: experts.map((e) => ({ id: e._id, ...e, _id: undefined })),
      companies: companies.map((c) => ({ id: c._id, ...c, _id: undefined })),
    }
  } catch (e) {
    console.error('[landing] fetch failed:', e?.message || e)
    return { products: [], experts: [], companies: [] }
  }
}

export default async function LandingPage() {
  const { products, experts, companies } = await getLandingData()
  const cookieStore = await cookies()
  const langCookie = cookieStore.get('lang')?.value
  const lang = SUPPORTED_LOCALES.includes(langCookie) ? langCookie : DEFAULT_LOCALE
  const t = (k) => translations[lang]?.[k] || translations[DEFAULT_LOCALE][k] || k
  const isAr = lang === 'ar'
  const ArrowIcon = isAr ? ArrowLeft : ArrowLeft // same icon; direction handled by dir attribute
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
            {/* Prominent Logo */}
            <div className="mb-8 flex justify-center">
              <div className="relative h-28 w-[260px] drop-shadow-[0_8px_24px_rgba(201,168,76,0.45)] sm:h-36 sm:w-[340px] md:h-44 md:w-[420px] lg:h-52 lg:w-[500px]">
                <Image
                  src="/logo.png"
                  alt="شعار مجلس رواد الأعمال العماني"
                  fill
                  sizes="(max-width: 640px) 260px, (max-width: 768px) 340px, (max-width: 1024px) 420px, 500px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-1.5 text-sm text-[#E8D08C]">
              <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />
              {t('hero.badge')}
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight md:text-6xl">
              {t('hero.title1')}
              <span className="mx-3 text-[#C9A84C]">{t('hero.title2')}</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-200 md:text-xl">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-6 py-3 text-base font-semibold text-[#1B3A6B] shadow-lg transition hover:bg-[#b89440]"
              >
                {t('hero.cta.join')}
                <ArrowLeft className={`h-5 w-5 ${isAr ? '' : 'rotate-180'}`} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                {t('nav.login')}
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 md:gap-12">
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+500</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">{t('stats.entrepreneurs')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+120</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">{t('stats.companies')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">+50</div>
                <div className="mt-1 text-xs text-gray-300 md:text-sm">{t('stats.experts')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold text-[#1B3A6B] md:text-4xl">{t('features.title')}</h2>
          <p className="mx-auto max-w-xl text-gray-600">{t('features.subtitle')}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShoppingBag, title: t('features.store.title'), desc: t('features.store.desc'), href: '/store' },
            { icon: GraduationCap, title: t('features.expert.title'), desc: t('features.expert.desc'), href: '/consultations' },
            { icon: Briefcase, title: t('features.dir.title'), desc: t('features.dir.desc'), href: '/directory' },
            { icon: Users, title: t('features.mem.title'), desc: t('features.mem.desc'), href: '/membership' },
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
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#C9A84C]/10 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
                <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" /> {t('products.badge')}
              </div>
              <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">{t('products.title')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('products.subtitle')}</p>
            </div>
            <Link href="/store" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
              {t('products.viewAll')} <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
            </Link>
          </div>
          {products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {products.map((p) => (
                <Link key={p.id} href={`/store/${p.id}`} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex h-32 items-center justify-center bg-gradient-to-bl from-gray-50 to-gray-100 text-4xl">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={(isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn} className="h-full w-full object-cover" />
                    ) : (
                      '🛍️'
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-bold text-[#1B3A6B] group-hover:text-[#C9A84C]">{(isAr ? p.nameAr : p.nameEn) || p.nameAr || p.nameEn}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-[#C9A84C]">{(p.price || 0).toFixed(2)} {t('products.currency')}</span>
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
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#C9A84C]/40 bg-gradient-to-bl from-[#C9A84C]/5 to-white px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C9A84C]/10 text-[#C9A84C]">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B3A6B]">{t('empty.products.title')}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t('empty.products.desc')}</p>
              <Link
                href="/signup?role=vendor"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-[#1B3A6B] shadow-sm transition hover:bg-[#b89440]"
              >
                {t('empty.products.cta')}
                <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* TOP EXPERTS */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <GraduationCap className="h-3.5 w-3.5" /> {t('experts.badge')}
            </div>
            <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">{t('experts.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('experts.subtitle')}</p>
          </div>
          <Link href="/consultations" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
            {t('experts.viewAll')} <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
          </Link>
        </div>
        {experts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {experts.map((e) => (
              <Link key={e.id} href={`/expert/${e.id}`} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-bl from-indigo-100 to-blue-100 text-2xl font-bold text-indigo-700">
                  {(e.name || '?').charAt(0)}
                </div>
                <div className="font-bold text-[#1B3A6B] group-hover:text-indigo-700">{e.name}</div>
                <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{isAr ? (e.specialtyAr || e.specialty) : (e.specialty || e.specialtyAr)}</div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#C9A84C]">
                    <Star className="h-3 w-3 fill-[#C9A84C]" /> {(e.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-gray-500">{e.totalSessions || 0} {t('experts.sessions')}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-bl from-indigo-50/50 to-white px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-[#1B3A6B]">{t('empty.experts.title')}</h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">{t('empty.experts.desc')}</p>
            <Link
              href="/dashboard/expert-application"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {t('empty.experts.cta')}
              <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
            </Link>
          </div>
        )}
      </section>

      {/* RECENTLY JOINED COMPANIES */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                <Building2 className="h-3.5 w-3.5" /> {t('companies.badge')}
              </div>
              <h2 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">{t('companies.title')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('companies.subtitle')}</p>
            </div>
            <Link href="/directory" className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] bg-white px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#1B3A6B] hover:text-white">
              {t('companies.viewAll')} <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
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
                      <div className="font-bold text-[#1B3A6B] group-hover:text-cyan-700 line-clamp-1">{isAr ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)}</div>
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
          {companies.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-gradient-to-bl from-cyan-50/50 to-white px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                <Building2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-[#1B3A6B]">{t('empty.companies.title')}</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">{t('empty.companies.desc')}</p>
              <Link
                href="/directory/register"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                {t('empty.companies.cta')}
                <ArrowLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} />
              </Link>
            </div>
          )}
          </div>
        </section>

      {/* VALUE PROPS */}
      <section className="bg-[#F8F9FA] py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-[#1B3A6B] md:text-4xl">{t('value.title')}</h2>
              <p className="mb-8 text-gray-600 leading-relaxed">
                {t('value.subtitle')}
              </p>
              <div className="space-y-5">
                {[
                  { icon: Shield, title: t('value.trust.title'), desc: t('value.trust.desc') },
                  { icon: TrendingUp, title: t('value.growth.title'), desc: t('value.growth.desc') },
                  { icon: Users, title: t('value.community.title'), desc: t('value.community.desc') },
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
                <div className="mb-6 text-sm font-medium text-[#C9A84C]">{t('value.membership.label')}</div>
                <div className="space-y-3">
                  {(['FREE', 'BASIC', 'GOLD', 'PLATINUM']).map((key) => {
                    const meta = TIER_META[key]
                    const isHighlighted = key === 'GOLD'
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between rounded-lg ${isHighlighted ? 'bg-[#C9A84C]/20 border border-[#C9A84C]/50' : 'bg-white/10'} px-4 py-3`}
                      >
                        <span className="font-semibold">{t(`tier.${key}`)}</span>
                        <span className="text-sm">
                          <span className="text-lg font-bold text-[#C9A84C]">{meta.price}</span> {t('value.membership.priceSuffix')}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Link href="/membership" className="mt-6 block w-full rounded-lg bg-[#C9A84C] py-3 text-center font-semibold text-[#1B3A6B] transition hover:bg-[#b89440]">
                  {t('value.membership.cta')}
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
          <h2 className="mb-4 text-3xl font-extrabold md:text-4xl">{t('joincta.title')}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-gray-200">
            {t('joincta.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-6 py-3 text-base font-bold text-[#1B3A6B] shadow-lg transition hover:bg-[#b89440]">
              {t('joincta.signup')} <ArrowLeft className={`h-5 w-5 ${isAr ? '' : 'rotate-180'}`} />
            </Link>
            <Link href="/membership" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/10">
              {t('joincta.browse')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
