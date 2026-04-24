'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Store,
  MapPin,
  Phone,
  Globe,
  Instagram,
  MessageCircle,
  Calendar,
  Package,
  ChevronRight,
  Crown,
  Copy,
  Check,
} from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { PRODUCT_CATEGORIES, formatOMR, categoryEmoji } from '@/lib/store'

const TIER_LABEL = { FREE: 'مجاني', BASIC: 'أساسي', GOLD: 'ذهبي', PLATINUM: 'بلاتيني' }
const GOV_LABEL = { MUSCAT:'مسقط', DHOFAR:'ظفار', MUSANDAM:'مسندم', BURAIMI:'البريمي', DAKHILIYAH:'الداخلية', SHARQIYAH:'الشرقية', WUSTA:'الوسطى', BATINAH:'الباطنة', DHAHIRAH:'الظاهرة' }

export default function VendorStorefront({ vendor, products }) {
  const [category, setCategory] = useState('')
  const [copied, setCopied] = useState(false)

  const filtered = useMemo(() => {
    if (!category) return products
    return products.filter((p) => p.category === category)
  }, [products, category])

  const categories = useMemo(() => {
    const counts = {}
    products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1 })
    return PRODUCT_CATEGORIES.filter((c) => counts[c.key]).map((c) => ({
      ...c,
      count: counts[c.key] || 0,
    }))
  }, [products])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const whatsappHref = vendor.whatsapp
    ? `https://wa.me/${vendor.whatsapp.replace(/\D/g, '')}`
    : null
  const instagramHref = vendor.instagram
    ? vendor.instagram.startsWith('http')
      ? vendor.instagram
      : `https://instagram.com/${vendor.instagram.replace('@', '')}`
    : null

  return (
    <div className="bg-[#F8F9FA]">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4">
        <nav className="flex items-center gap-1 text-xs text-gray-500">
          <Link href="/store" className="hover:text-[#1B3A6B]">المتجر</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-700">{vendor.businessName}</span>
        </nav>
      </div>

      {/* Banner + header */}
      <div className="container mx-auto px-4 pt-2">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div
            className="h-36 w-full bg-gradient-to-bl from-[#1B3A6B] via-[#264b84] to-[#C9A84C] md:h-48"
            style={vendor.banner ? { backgroundImage: `url(${vendor.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          />
          <div className="-mt-12 flex flex-wrap items-end gap-4 px-5 pb-5 md:px-7">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#F8F9FA] shadow-md">
              {vendor.logo ? (
                <img src={vendor.logo} alt={vendor.businessName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-bl from-[#1B3A6B] to-[#C9A84C] text-3xl font-extrabold text-white">
                  {(vendor.businessName || '؟').charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-14 md:pt-16">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#1B3A6B] md:text-2xl">
                  {vendor.businessName}
                </h1>
                {vendor.membershipTier === 'PLATINUM' && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-bl from-[#7C3AED] to-[#5b21b6] px-2 py-0.5 text-[10px] font-bold text-white">
                    <Crown className="h-3 w-3" /> بلاتيني
                  </span>
                )}
                {vendor.membershipTier === 'GOLD' && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#C9A84C] px-2 py-0.5 text-[10px] font-bold text-[#1B3A6B]">
                    <Crown className="h-3 w-3" /> ذهبي
                  </span>
                )}
              </div>
              {vendor.tagline && (
                <p className="mt-0.5 text-sm text-gray-600">{vendor.tagline}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {products.length} منتج
                </span>
                {(vendor.governorate || vendor.city) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[GOV_LABEL[vendor.governorate] || vendor.governorate, vendor.city].filter(Boolean).join('، ')}
                  </span>
                )}
                {vendor.memberSince && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    عضو منذ {new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(new Date(vendor.memberSince))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                  <MessageCircle className="h-3.5 w-3.5" /> واتساب
                </a>
              )}
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <Phone className="h-3.5 w-3.5" /> اتصال
                </a>
              )}
              {instagramHref && (
                <a href={instagramHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-pink-300 bg-white px-3 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-50">
                  <Instagram className="h-3.5 w-3.5" />
                </a>
              )}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              )}
              <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" title="نسخ الرابط">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Bio */}
        {vendor.bio && (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-[#1B3A6B]">عن المتجر</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{vendor.bio}</p>
          </div>
        )}

        {/* Categories filter */}
        {categories.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <CategoryPill active={!category} label={`الكل (${products.length})`} emoji="🛍️" onClick={() => setCategory('')} />
            {categories.map((c) => (
              <CategoryPill
                key={c.key}
                active={category === c.key}
                label={`${c.label} (${c.count})`}
                emoji={c.emoji}
                onClick={() => setCategory(c.key)}
              />
            ))}
          </div>
        )}

        {/* Products */}
        <div className="mt-5 pb-10">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#1B3A6B]">
            <Store className="h-4 w-4" /> المنتجات
          </h2>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              لا توجد منتجات في هذه الفئة بعد
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryPill({ active, label, emoji, onClick }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${active ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'}`}>
      <span className="text-sm">{emoji}</span>
      {label}
    </button>
  )
}
