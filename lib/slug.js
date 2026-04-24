// Slug helper for vendor storefront URLs.
// Supports Arabic characters (modern URLs handle UTF-8 fine), falls back to
// short user id when the name has no slugifiable characters.

export function slugify(input) {
  if (!input) return ''
  return String(input)
    .trim()
    .toLowerCase()
    // replace any whitespace or forbidden URL chars with a hyphen
    .replace(/[\s\/\\?#&=+<>:;"'`~!@$%^*(){}[\]|,.]+/g, '-')
    // collapse repeated hyphens
    .replace(/-+/g, '-')
    // trim hyphens from start/end
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate a unique vendor slug given a desired source (businessName) and a
 * fallback seed (userId). Checks Mongo for collisions and appends -2/-3/...
 */
export async function uniqueVendorSlug(UserModel, source, fallbackSeed) {
  let base = slugify(source)
  if (!base) base = String(fallbackSeed || '').slice(0, 8)
  if (!base) base = 'vendor'
  let candidate = base
  let n = 1
  // Soft cap to avoid infinite loops.
  while (n < 50) {
    const exists = await UserModel.exists({ 'vendorProfile.slug': candidate })
    if (!exists) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  // give up and use user id
  return `${base}-${String(fallbackSeed || Date.now()).slice(-6)}`
}
