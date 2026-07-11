import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Product } from '@/lib/models'

/**
 * POST /products/ai-search
 * Body: { query: string }
 * Uses a Python subprocess (via EMERGENT_LLM_KEY) to infer structured filters
 * from a free-text Arabic/English query, then returns matching products.
 * Filters are cached in-memory for 5 minutes.
 */
export async function handleAiSearch(request) {
  await connectDB()
  const body = await request.json().catch(() => ({}))
  const query = String(body?.query || '').trim()
  if (!query) {
    return NextResponse.json({ error: 'استعلام البحث فارغ' }, { status: 400 })
  }
  if (query.length > 200) {
    return NextResponse.json(
      { error: 'الاستعلام طويل جداً (الحد الأقصى 200 حرف)' },
      { status: 400 }
    )
  }

  const cacheKey = query.toLowerCase().replace(/\s+/g, ' ').trim()
  const now = Date.now()
  if (!global.__aiSearchCache) global.__aiSearchCache = new Map()
  const cache = global.__aiSearchCache
  if (cache.size > 200) {
    for (const [k, v] of cache) {
      if (now - v.t > 5 * 60 * 1000) cache.delete(k)
      if (cache.size <= 100) break
    }
  }

  const catsAgg = await Product.distinct('category', { isActive: true })
  const allowedCategories = (catsAgg || []).filter(Boolean)
  const tagsAgg = await Product.aggregate([
    { $match: { isActive: true, tags: { $exists: true, $ne: [] } } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ])
  const allowedTags = (tagsAgg || [])
    .map((t) => String(t._id || '').toLowerCase())
    .filter(Boolean)

  let filters
  const cached = cache.get(cacheKey)
  if (cached && now - cached.t < 5 * 60 * 1000) {
    filters = cached.filters
  } else {
    const { spawn } = await import('node:child_process')
    const result = await new Promise((resolve) => {
      const pyBin = '/root/.venv/bin/python3'
      const proc = spawn(pyBin, ['/app/lib/ai_search.py'], {
        env: { ...process.env, EMERGENT_LLM_KEY: process.env.EMERGENT_LLM_KEY || '' },
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => {
        stdout += d.toString()
      })
      proc.stderr.on('data', (d) => {
        stderr += d.toString()
      })
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch (_) {}
        resolve({ ok: false, error: 'انتهت مهلة البحث الذكي' })
      }, 25000)
      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) {
          console.error('[ai-search] exit', code, 'stderr:', stderr.slice(0, 500))
          try {
            const j = JSON.parse(stdout || '{}')
            if (j?.error) return resolve({ ok: false, error: j.error })
          } catch (_) {}
          return resolve({ ok: false, error: 'فشل البحث الذكي' })
        }
        try {
          resolve({ ok: true, data: JSON.parse(stdout) })
        } catch (e) {
          resolve({ ok: false, error: 'استجابة غير صالحة' })
        }
      })
      proc.stdin.write(
        JSON.stringify({
          query,
          categories: allowedCategories,
          tags: allowedTags,
        })
      )
      proc.stdin.end()
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    filters = result.data?.filters || {}
    cache.set(cacheKey, { filters, t: now })
  }

  // Build mongo query from filters
  const q = { isActive: true }
  if (filters.category) q.category = filters.category
  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    q.tags = { $in: filters.tags }
  }
  if (filters.search) {
    const rx = new RegExp(
      filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    q.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }, { tags: rx }]
  }
  const priceFilter = {}
  if (typeof filters.minPrice === 'number') priceFilter.$gte = filters.minPrice
  if (typeof filters.maxPrice === 'number') priceFilter.$lte = filters.maxPrice
  if (Object.keys(priceFilter).length > 0) q.price = priceFilter
  if (filters.minRating > 0) q.rating = { $gte: filters.minRating }

  const products = await Product.find(q)
    .sort({ rating: -1, salesCount: -1 })
    .limit(40)
    .lean()
  return NextResponse.json({
    query,
    filters,
    interpretation_ar: filters.interpretation_ar || '',
    cached: !!cached,
    products: products.map((p) => ({ id: p._id, ...p, _id: undefined })),
    count: products.length,
  })
}
