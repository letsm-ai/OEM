// Approximate Oman governorate centroids (lat, lng). Used when a Company
// has no explicit lat/lng set — its pin will be placed at its governorate
// centroid with small deterministic jitter to avoid overlap.

export const GOVERNORATE_CENTROIDS = {
  MUSCAT: { lat: 23.5880, lng: 58.3829 },
  DHOFAR: { lat: 17.0151, lng: 54.0924 },
  MUSANDAM: { lat: 26.2000, lng: 56.2499 },
  BURAIMI: { lat: 24.2500, lng: 55.7833 },
  DAKHILIYAH: { lat: 22.9333, lng: 57.5333 },
  SHARQIYAH: { lat: 22.3167, lng: 58.7833 },
  WUSTA: { lat: 19.9833, lng: 56.5000 },
  BATINAH: { lat: 24.3500, lng: 56.7167 },
  DHAHIRAH: { lat: 23.2167, lng: 56.5167 },
}

// Default map view (center of Oman) + zoom
export const OMAN_CENTER = { lat: 21.4735, lng: 55.9754, zoom: 6 }

// Bounding box (approx) for Oman to keep pins reasonable even on bad input
export const OMAN_BOUNDS = {
  south: 16.6,
  north: 27.0,
  west: 51.5,
  east: 60.0,
}

function hashString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Deterministic small jitter (~+/-0.15°) around a centroid so multiple
 * companies in the same governorate don't stack on top of each other.
 */
export function jitterForId(id) {
  const h = Math.abs(hashString(String(id || '')))
  const dx = (((h % 1000) / 1000) - 0.5) * 0.3 // ±0.15
  const dy = ((((h / 1000) % 1000) / 1000) - 0.5) * 0.3
  return { lat: dy, lng: dx }
}

/**
 * Resolve a display lat/lng for a company:
 *   - if it has valid lat/lng → use them (clamped to Oman bounds)
 *   - else if governorate has a centroid → centroid + jitter by id
 *   - else → Oman center + jitter by id
 */
export function resolveCompanyLatLng(company) {
  const { lat, lng, governorate, id, _id } = company || {}
  const validNum = (v) =>
    typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v)
  if (validNum(lat) && validNum(lng)) {
    return {
      lat: Math.min(Math.max(lat, OMAN_BOUNDS.south), OMAN_BOUNDS.north),
      lng: Math.min(Math.max(lng, OMAN_BOUNDS.west), OMAN_BOUNDS.east),
      precise: true,
    }
  }
  const c = GOVERNORATE_CENTROIDS[governorate] || OMAN_CENTER
  const j = jitterForId(id || _id)
  return {
    lat: c.lat + j.lat,
    lng: c.lng + j.lng,
    precise: false,
  }
}

export function isValidLatLng(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false
  if (lat < OMAN_BOUNDS.south || lat > OMAN_BOUNDS.north) return false
  if (lng < OMAN_BOUNDS.west || lng > OMAN_BOUNDS.east) return false
  return true
}
