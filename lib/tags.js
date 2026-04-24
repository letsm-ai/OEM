// Tags helpers. Normalize user-input tags: lowercase, trim, remove duplicates, cap length.

const MAX_TAG_LENGTH = 30
const MAX_TAGS_PER_PRODUCT = 15

export { MAX_TAG_LENGTH, MAX_TAGS_PER_PRODUCT }

/**
 * Normalize a single tag.
 * - trim, lowercase (for Latin; Arabic stays as-is)
 * - replace internal whitespace with '-'
 * - strip chars that are not letters/digits/dash/underscore (allow Arabic letters & Latin)
 */
export function normalizeTag(raw) {
  if (typeof raw !== 'string') return ''
  let t = raw.trim()
  if (!t) return ''
  // Strip leading '#'
  t = t.replace(/^#+/, '')
  t = t.toLowerCase() // lowercase latin; arabic unaffected
  // Replace spaces with '-'
  t = t.replace(/\s+/g, '-')
  // Keep: word chars (Latin), Arabic block U+0600..U+06FF, dash, underscore
  t = t.replace(/[^\u0600-\u06FF\w\-_]/g, '')
  if (t.length > MAX_TAG_LENGTH) t = t.slice(0, MAX_TAG_LENGTH)
  return t
}

/**
 * Normalize an array of tags: deduplicate, cap count.
 */
export function normalizeTags(arr) {
  if (!Array.isArray(arr)) return []
  const set = new Set()
  const out = []
  for (const raw of arr) {
    const t = normalizeTag(raw)
    if (!t) continue
    if (set.has(t)) continue
    set.add(t)
    out.push(t)
    if (out.length >= MAX_TAGS_PER_PRODUCT) break
  }
  return out
}
