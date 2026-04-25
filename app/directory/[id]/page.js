import { notFound } from 'next/navigation'
import Link from 'next/link'
import { connectDB } from '@/lib/db'
import { Company, User } from '@/lib/models'
import {
  sectorLabel,
  governorateLabel,
  STATUS_LABELS,
  STATUS_BADGE,
} from '@/lib/directory'
import { TIER_META } from '@/lib/membership'
import SocialIcons from '@/components/SocialIcons'
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  ArrowRight,
  Building2,
  Crown,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CompanyProfilePage({ params }) {
  await connectDB()
  const company = await Company.findById(params.id).lean()
  if (!company || company.status !== 'APPROVED') {
    notFound()
  }
  const owner = await User.findById(company.userId)
    .select({ name: 1, membershipTier: 1 })
    .lean()

  const featured =
    owner?.membershipTier === 'GOLD' || owner?.membershipTier === 'PLATINUM'

  const mapSrc = company.location
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        [company.location, governorateLabel(company.governorate)]
          .filter(Boolean)
          .join(', ')
      )}&output=embed`
    : null

  return (
    <div className="bg-[#F8F9FA] py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <Link
          href="/directory"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للدليل
        </Link>

        {/* Header card */}
        <div
          className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
            featured ? 'border-[#C9A84C]' : 'border-gray-200'
          }`}
        >
          <div
            className={`relative h-36 ${
              featured
                ? 'bg-gradient-to-bl from-[#1B3A6B] to-[#152c52]'
                : 'bg-gradient-to-bl from-[#F8F9FA] to-white'
            }`}
          >
            {featured && (
              <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-[#C9A84C] px-3 py-1 text-xs font-bold text-[#1B3A6B]">
                <Crown className="h-3 w-3" />
                عضو {TIER_META[owner.membershipTier]?.nameAr}
              </div>
            )}
          </div>
          <div className="relative px-6 pb-6">
            <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={company.nameAr}
                  className="h-28 w-28 rounded-2xl border-4 border-white bg-white object-cover shadow-md"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-white bg-white text-4xl font-extrabold text-[#1B3A6B] shadow-md">
                  {company.nameAr?.charAt(0) || <Building2 className="h-10 w-10" />}
                </div>
              )}
            </div>
            <div className="mt-4">
              <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
                {company.nameAr}
              </h1>
              {company.nameEn && (
                <div dir="ltr" className="mt-1 text-right text-sm text-gray-500">
                  {company.nameEn}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-semibold text-[#1B3A6B]">
                  {sectorLabel(company.sector)}
                </span>
                {company.governorate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A84C]/10 px-3 py-1 text-xs font-semibold text-[#8a6f2d]">
                    <MapPin className="h-3 w-3" />
                    {governorateLabel(company.governorate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Description + services */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-bold text-[#1B3A6B]">عن الشركة</h2>
              {company.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {company.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400">لا يوجد وصف</p>
              )}

              {Array.isArray(company.services) && company.services.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <h3 className="mb-3 text-sm font-bold text-[#1B3A6B]">الخدمات</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.services.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-[#F8F9FA] px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            {mapSrc && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3 text-sm font-bold text-[#1B3A6B]">
                  <MapPin className="h-4 w-4" />
                  الموقع
                </div>
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="320"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="الموقع على خريطة جوجل"
                />
              </div>
            )}
          </div>

          {/* Contact */}
          <aside>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-bold text-[#1B3A6B]">معلومات التواصل</h3>
              <ul className="space-y-3 text-sm">
                {company.phone && (
                  <li>
                    <a
                      href={`tel:${company.phone}`}
                      className="flex items-center gap-3 rounded-lg p-2 text-gray-700 hover:bg-[#F8F9FA]"
                    >
                      <Phone className="h-4 w-4 text-[#1B3A6B]" />
                      <span dir="ltr">{company.phone}</span>
                    </a>
                  </li>
                )}
                {company.email && (
                  <li>
                    <a
                      href={`mailto:${company.email}`}
                      className="flex items-center gap-3 rounded-lg p-2 text-gray-700 hover:bg-[#F8F9FA]"
                    >
                      <Mail className="h-4 w-4 text-[#1B3A6B]" />
                      <span dir="ltr">{company.email}</span>
                    </a>
                  </li>
                )}
                {company.website && (
                  <li>
                    <a
                      href={
                        company.website.startsWith('http')
                          ? company.website
                          : `https://${company.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg p-2 text-gray-700 hover:bg-[#F8F9FA]"
                    >
                      <Globe className="h-4 w-4 text-[#1B3A6B]" />
                      <span dir="ltr" className="truncate">
                        {company.website.replace(/^https?:\/\//, '')}
                      </span>
                    </a>
                  </li>
                )}
                {company.location && (
                  <li className="flex items-start gap-3 rounded-lg p-2 text-gray-700">
                    <MapPin className="mt-0.5 h-4 w-4 text-[#1B3A6B]" />
                    <span>
                      {company.location}
                      {company.governorate
                        ? `، ${governorateLabel(company.governorate)}`
                        : ''}
                    </span>
                  </li>
                )}
                {!company.phone && !company.email && !company.website && (
                  <li className="text-xs text-gray-400">لا توجد معلومات تواصل مدرجة</li>
                )}
              </ul>

              {/* Social media links — large icons */}
              {company.social && Object.values(company.social).some((v) => v) && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-2 text-xs font-semibold text-gray-500">تابعنا على</div>
                  <SocialIcons links={company.social} size="lg" />
                </div>
              )}

              {owner?.name && (
                <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  صاحب الشركة: <span className="font-semibold text-[#1B3A6B]">{owner.name}</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
