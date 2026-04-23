'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import Link from 'next/link'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Building2, MapPin, Award, ExternalLink } from 'lucide-react'
import {
  OMAN_CENTER,
  resolveCompanyLatLng,
} from '@/lib/geo'
import { sectorLabel, governorateLabel } from '@/lib/directory'

/**
 * Build a DivIcon (gold pin for featured, navy for regular, with company
 * initial). Using DivIcon avoids the default-marker-shadow asset path issues.
 */
function buildIcon({ featured, label }) {
  const bg = featured ? '#C9A84C' : '#1B3A6B'
  const fg = featured ? '#1B3A6B' : '#FFFFFF'
  return L.divIcon({
    className: 'majles-marker',
    html: `
      <div style="
        transform: translate(-50%, -100%);
        display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:34px;height:34px;border-radius:50% 50% 50% 0;
          background:${bg};
          border:3px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          font-family:Cairo,sans-serif;font-weight:800;font-size:14px;color:${fg};
        ">
          <span style="transform:rotate(45deg);line-height:1;">${label || '•'}</span>
        </div>
      </div>
    `,
    iconSize: [34, 44],
    iconAnchor: [0, 0],
    popupAnchor: [0, -40],
  })
}

/**
 * Fits the map bounds to the list of markers whenever it changes,
 * but only when there is at least one marker.
 */
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 9, { animate: true })
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
  }, [points, map])
  return null
}

export default function DirectoryMap({ companies, featuredIds, height = 560 }) {
  const points = useMemo(() => {
    return (companies || []).map((c) => {
      const { lat, lng, precise } = resolveCompanyLatLng(c)
      return { ...c, lat, lng, precise }
    })
  }, [companies])

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ height }}
    >
      <MapContainer
        center={[OMAN_CENTER.lat, OMAN_CENTER.lng]}
        zoom={OMAN_CENTER.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((c) => {
          const featured = featuredIds?.includes(c.id)
          return (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={buildIcon({
                featured,
                label: (c.nameAr || '؟').trim().charAt(0),
              })}
            >
              <Popup maxWidth={280} className="majles-popup">
                <div
                  dir="rtl"
                  style={{ fontFamily: 'Cairo, sans-serif', minWidth: 220 }}
                  className="text-right"
                >
                  <div className="flex items-start gap-2">
                    {c.logo ? (
                      <img
                        src={c.logo}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B3A6B]/5 text-[#1B3A6B]">
                        <Building2 className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <div className="font-bold text-[#1B3A6B] leading-tight">
                          {c.nameAr}
                        </div>
                        {featured && (
                          <Award className="h-3.5 w-3.5 text-[#C9A84C]" />
                        )}
                      </div>
                      {c.nameEn && (
                        <div className="text-[11px] text-gray-500">{c.nameEn}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {c.sector && (
                      <span className="rounded-full bg-[#1B3A6B]/10 px-2 py-0.5 text-[11px] font-medium text-[#1B3A6B]">
                        {sectorLabel(c.sector)}
                      </span>
                    )}
                    {c.governorate && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[11px] font-medium text-[#8a6f2d]">
                        <MapPin className="h-3 w-3" />
                        {governorateLabel(c.governorate)}
                      </span>
                    )}
                  </div>
                  {!c.precise && (
                    <div className="mt-1.5 text-[10px] text-gray-400">
                      الموقع تقريبي (حسب المحافظة)
                    </div>
                  )}
                  {c.description && (
                    <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-gray-700">
                      {c.description}
                    </p>
                  )}
                  <Link
                    href={`/directory/${c.id}`}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#1B3A6B] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#152c52]"
                  >
                    عرض التفاصيل
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
