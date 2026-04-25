/**
 * Helper to sanitize social media links submitted by users.
 *
 * Accepts an object like:
 *   { instagram, facebook, twitter, linkedin, whatsapp, tiktok, snapchat, youtube }
 *
 * Rules:
 *   - Only the 8 known keys are kept.
 *   - Each value is trimmed and capped at 300 chars.
 *   - Empty strings are kept as '' (so users can clear fields).
 *   - Auto-prefix https:// if a URL-like field doesn't start with http(s)://, except
 *     for 'whatsapp' which can be a phone number (e.g. +96891234567).
 */
const ALLOWED = ['instagram', 'facebook', 'twitter', 'linkedin', 'whatsapp', 'tiktok', 'snapchat', 'youtube']

function normalizeOne(key, raw) {
  const s = String(raw ?? '').trim().slice(0, 300)
  if (!s) return ''
  // Whatsapp: keep digits + leading +
  if (key === 'whatsapp') {
    // If user pasted a wa.me/ link, strip to digits.
    const m = s.match(/wa\.me\/(\+?\d{6,20})/i)
    if (m) return m[1].replace(/[^0-9+]/g, '')
    if (/^\+?\d{6,20}$/.test(s)) return s
    // Otherwise keep as URL
    if (/^https?:\/\//i.test(s)) return s
    return '+' + s.replace(/[^0-9]/g, '').slice(0, 19)
  }
  // Other URL-like fields: ensure scheme.
  if (/^https?:\/\//i.test(s)) return s
  // Allow @handles (auto-build instagram/twitter URLs)
  if (s.startsWith('@')) {
    const handle = s.slice(1).replace(/[^A-Za-z0-9._-]/g, '')
    if (key === 'instagram') return `https://www.instagram.com/${handle}/`
    if (key === 'twitter')   return `https://twitter.com/${handle}`
    if (key === 'tiktok')    return `https://www.tiktok.com/@${handle}`
    if (key === 'snapchat')  return `https://www.snapchat.com/add/${handle}`
  }
  return `https://${s}`
}

export function sanitizeSocial(input) {
  const out = {}
  if (!input || typeof input !== 'object') {
    for (const k of ALLOWED) out[k] = ''
    return out
  }
  for (const k of ALLOWED) {
    out[k] = normalizeOne(k, input[k])
  }
  return out
}

export const SOCIAL_KEYS = ALLOWED
