'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, ShoppingBag, ShoppingCart, Store as StoreIcon, Heart, Package, SlidersHorizontal, X, Star, Sparkles, Loader2 } from 'lucide-react'
import { PRODUCT_CATEGORIES, categoryLabel, categoryEmoji, SUBCATEGORIES } from '@/lib/store'
import ProductCard from '@/components/ProductCard'
import { useCart } from '@/components/CartContext'
import { useWishlist } from '@/components/WishlistContext'
import { useI18n } from '@/lib/i18n/I18nContext'

export default function StoreClient({ initialProducts }) {
  return (
    <Suspense fallback={null}>
      <StoreInner initialProducts={initialProducts} />
    </Suspense>
  )
}

function StoreInner({ initialProducts }) {
  const router = useRouter()
  const sp = useSearchParams()
  const { totals } = useCart()
  const { count: favCount } = useWishlist()
  const { t, isRTL, isAr } = useI18n()
  const category = sp.get('category') || ''
  const subcategory = sp.get('subcategory') || ''
  const search = sp.get('search') || ''
  const sort = sp.get('sort') || 'newest'
  const tags = sp.get('tags') || ''
  const minPrice = sp.get('minPrice') || ''
  const maxPrice = sp.get('maxPrice') || ''
  const minRating = sp.get('minRating') || ''
  const freeShipping = sp.get('freeShipping') === '1'

  const [showFilters, setShowFilters] = useState(false)
  const [popularTags, setPopularTags] = useState([])
  const [aiResults, setAiResults] = useState(null) // { query, interpretation_ar, products, count }
  useEffect(() => {
    fetch('/api/tags/popular?limit=15')
      .then((r) => r.json())
      .then((d) => setPopularTags(d?.tags || []))
      .catch(() => {})
  }, [])

  const setParam = (key, value) => {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    // When changing category, drop the subcategory
    if (key === 'category') p.delete('subcategory')
    router.push(`/store?${p.toString()}`)
  }

  const toggleTag = (t) => {
    const current = tags.split(',').map((x) => x.trim()).filter(Boolean)
    let next
    if (current.includes(t)) next = current.filter((x) => x !== t)
    else next = [...current, t]
    setParam('tags', next.join(','))
  }

  const clearAllFilters = () => {
    router.push('/store')
  }

  const activeFilterCount = [
    category, search, tags, minPrice, maxPrice, minRating, freeShipping ? '1' : ''
  ].filter(Boolean).length

  const onSearch = (e) => {
    e.preventDefault()
    const v = e.target.elements.q.value.trim()
    setParam('search', v)
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-medium text-[#1B3A6B]">
              <StoreIcon className="h-4 w-4" /> {t('store.badge')}
            </div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
              {t('store.title')}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {initialProducts.length} {t('store.subtitle.count')}
            </p>
          </div>
          <Link
            href="/store/cart"
            className="relative inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#152c52]"
          >
            <ShoppingCart className="h-4 w-4" />
            {t('store.cart')}
            {totals.unitCount > 0 && (
              <span className={`absolute -top-2 ${isRTL ? '-left-2' : '-right-2'} flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A84C] px-1 text-[11px] font-bold text-[#1B3A6B]`}>
                {totals.unitCount}
              </span>
            )}
          </Link>
        </div>

        {/* Quick links strip */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href="/store/wishlist"
            className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-200 hover:text-red-600"
          >
            <Heart className={`h-3.5 w-3.5 ${favCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
            {t('store.wishlist')}
            {favCount > 0 && (
              <span className="ms-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            href="/store/vendor"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
          >
            <StoreIcon className="h-3.5 w-3.5" /> {t('store.vendors')}
          </Link>
        </div>

        {/* AI Search Bar (powered by LLM) */}
        <AiSearchBar
          onResults={setAiResults}
          activeQuery={aiResults?.query || ''}
          onClear={() => setAiResults(null)}
          t={t}
        />

        {/* Search + Sort + Filters toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <form onSubmit={onSearch} className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder={t('store.search.placeholder')}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${activeFilterCount > 0 ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#1B3A6B]' : 'border-gray-300 bg-white text-gray-700'}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t('store.filters')}
            {activeFilterCount > 0 && (
              <span className="ms-1 rounded-full bg-[#1B3A6B] px-1.5 text-[10px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none"
          >
            <option value="newest">{t('store.sort.newest')}</option>
            <option value="popular">{t('store.sort.popular')}</option>
            <option value="price_asc">{t('store.sort.price_asc')}</option>
            <option value="price_desc">{t('store.sort.price_desc')}</option>
          </select>
        </div>

        {/* Advanced Filters (collapsible) */}
        {showFilters && (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-[#1B3A6B]">{t('store.filters.advanced')}</div>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100">
                  <X className="h-3 w-3" /> {t('store.filters.clearAll')}
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">{t('store.filters.priceRange')}</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" step="0.5" defaultValue={minPrice} onBlur={(e) => setParam('minPrice', e.target.value)} placeholder={t('store.filters.priceFrom')} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]" />
                  <span className="text-gray-400">—</span>
                  <input type="number" min="0" step="0.5" defaultValue={maxPrice} onBlur={(e) => setParam('maxPrice', e.target.value)} placeholder={t('store.filters.priceTo')} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#1B3A6B]" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">{t('store.filters.rating')}</label>
                <div className="flex gap-1">
                  {[0, 3, 4].map((r) => (
                    <button
                      key={r}
                      onClick={() => setParam('minRating', String(minRating) === String(r) ? '' : String(r))}
                      className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${Number(minRating) === r ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#1B3A6B]' : 'border-gray-300 bg-white text-gray-600'}`}
                    >
                      {r === 0 ? t('store.filters.ratingAll') : (<><Star className="h-3 w-3 fill-[#C9A84C] text-[#C9A84C]" /> {r}+</>)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">{t('store.filters.shipping')}</label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={freeShipping}
                    onChange={(e) => setParam('freeShipping', e.target.checked ? '1' : '')}
                    className="h-3.5 w-3.5 accent-[#C9A84C]"
                  />
                  {t('store.filters.freeShipping')}
                </label>
              </div>
            </div>
            {/* Popular tags cloud */}
            {popularTags.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="mb-1.5 text-[11px] font-semibold text-gray-700">{t('store.filters.popularTags')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.map((tag) => {
                    const active = tags.split(',').map((x) => x.trim()).includes(tag.tag)
                    return (
                      <button
                        key={tag.tag}
                        onClick={() => toggleTag(tag.tag)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${active ? 'border-[#C9A84C] bg-[#C9A84C] text-[#1B3A6B]' : 'border-gray-300 bg-white text-gray-700 hover:border-[#1B3A6B]'}`}
                      >
                        #{tag.tag}
                        <span className="text-[9px] opacity-60">({tag.count})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Categories */}
        <div className="mb-5 flex flex-wrap gap-2">
          <CategoryPill
            active={!category}
            onClick={() => setParam('category', '')}
            label={t('store.category.all')}
            emoji="🛍️"
          />
          {PRODUCT_CATEGORIES.map((c) => (
            <CategoryPill
              key={c.key}
              active={category === c.key}
              onClick={() => setParam('category', c.key)}
              label={c.label}
              emoji={c.emoji}
            />
          ))}
        </div>

        {/* Subcategories (when a category is selected) */}
        {category && SUBCATEGORIES[category] && SUBCATEGORIES[category].length > 0 && (
          <div className="mb-5 -mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setParam('subcategory', '')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${!subcategory ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'}`}
            >
              {t('store.category.all')}
            </button>
            {SUBCATEGORIES[category].map((s) => (
              <button
                key={s.key}
                onClick={() => setParam('subcategory', s.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${subcategory === s.key ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#1B3A6B]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#C9A84C] hover:text-[#1B3A6B]'}`}
              >
                {s.labelAr}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {aiResults ? (
          <>
            {/* AI interpretation banner */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-xs font-semibold text-purple-700">{t('store.ai.resultsBanner')} • {aiResults.count} {t('store.ai.products')}</div>
                  <div className="text-sm font-bold text-[#1B3A6B]">&ldquo;{aiResults.query}&rdquo;</div>
                  {aiResults.interpretation_ar && (
                    <div className="mt-1 text-xs text-gray-600">{aiResults.interpretation_ar}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAiResults(null)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <X className="h-3 w-3" /> {t('store.ai.close')}
              </button>
            </div>

            {aiResults.products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-purple-400" />
                <h3 className="mt-3 text-lg font-bold text-gray-700">{t('store.ai.noMatch')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('store.ai.noMatchHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {aiResults.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </>
        ) : initialProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-gray-400" />
            <h3 className="mt-3 text-lg font-bold text-gray-700">{t('store.empty.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('store.empty.hint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {initialProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryPill({ active, onClick, label, emoji }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]'
      }`}
    >
      <span className="text-sm">{emoji}</span>
      {label}
    </button>
  )
}

const AI_EXAMPLES = [
  'أحذية رياضية أقل من 50 ريال',
  'هدايا للأطفال',
  'منتجات عسل عماني طبيعي',
  'ملابس صيفية مريحة',
  'إكسسوارات هاتف بتقييم ممتاز',
]

function AiSearchBar({ onResults, activeQuery, onClear, t }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeQuery) setQuery('')
  }, [activeQuery])

  const runSearch = async (q) => {
    const text = (q ?? query).trim()
    if (!text) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/products/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || t('store.ai.error'))
        return
      }
      setQuery(text)
      onResults?.({
        query: text,
        interpretation_ar: data.interpretation_ar || '',
        products: data.products || [],
        count: data.count || 0,
      })
      // Smooth scroll to results
      setTimeout(() => {
        const el = document.querySelector('[data-ai-results-anchor]')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e) {
      setError(t('store.ai.error.network'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runSearch()
  }

  return (
    <div data-ai-results-anchor className="mb-4 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-indigo-50 to-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1B3A6B]">{t('store.ai.title')}</div>
            <div className="text-[11px] text-gray-500">{t('store.ai.subtitle')}</div>
          </div>
        </div>
        {activeQuery && (
          <button
            onClick={() => { setQuery(''); onClear?.() }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-3 w-3" /> {t('store.ai.clear')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 focus-within:border-purple-500">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('store.ai.placeholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            maxLength={200}
            disabled={loading}
          />
          {query && !loading && (
            <button type="button" onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:from-purple-700 hover:to-indigo-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t('store.ai.searching')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> {t('store.ai.search')}
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Example chips */}
      {!activeQuery && !loading && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-500">{t('store.ai.try')}</span>
          {AI_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setQuery(ex); runSearch(ex) }}
              className="rounded-full border border-purple-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-purple-700 transition hover:border-purple-400 hover:bg-purple-50"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
