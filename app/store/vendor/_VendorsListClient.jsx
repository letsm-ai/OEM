'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, MapPin, Package, Loader2 } from 'lucide-react'

const GOV_LABEL = { MUSCAT:'مسقط', DHOFAR:'ظفار', MUSANDAM:'مسندم', BURAIMI:'البريمي', DAKHILIYAH:'الداخلية', SHARQIYAH:'الشرقية', WUSTA:'الوسطى', BATINAH:'الباطنة', DHAHIRAH:'الظاهرة' }

export default function VendorsListClient() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/vendors').then((r) => r.json()).then((d) => {
      setList(d.vendors || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex items-center gap-2">
          <Store className="h-6 w-6 text-[#1B3A6B]" />
          <div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B]">البائعون</h1>
            <p className="text-sm text-gray-500">تعرف على تجّارنا المعتمدين</p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#1B3A6B]" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">لا يوجد بائعون حالياً</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((v) => (
              <Link
                key={v.id}
                href={`/store/vendor/${encodeURIComponent(v.slug)}`}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
              >
                <div
                  className="h-24 w-full bg-gradient-to-bl from-[#1B3A6B] to-[#C9A84C]"
                  style={v.banner ? { backgroundImage: `url(${v.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                />
                <div className="-mt-6 px-4 pb-4">
                  <div className="mb-2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-[#F8F9FA]">
                    {v.logo ? <img src={v.logo} alt="" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-extrabold text-[#C9A84C]">{(v.businessName || '?').charAt(0)}</div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-[#1B3A6B] group-hover:text-[#152c52]">{v.businessName}</div>
                  {v.tagline && <div className="line-clamp-1 text-xs text-gray-500">{v.tagline}</div>}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{v.productCount} منتج</span>
                    {v.governorate && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{GOV_LABEL[v.governorate] || v.governorate}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
