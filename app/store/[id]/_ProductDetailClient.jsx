'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ShoppingCart, Minus, Plus, ChevronRight, CheckCircle2, Package, Tag, Store as StoreIcon, ArrowLeft, Star, MessageSquare, Lock, Heart, Sparkles } from 'lucide-react'
import { formatOMR, categoryEmoji, categoryLabel } from '@/lib/store'
import { useCart } from '@/components/CartContext'
import { useWishlist } from '@/components/WishlistContext'
import ProductCard from '@/components/ProductCard'

function StarRow({ value = 0, size = 'h-4 w-4', interactive = false, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(n)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition`}
          aria-label={`${n} نجوم`}
        >
          <Star
            className={`${size} ${
              n <= Math.round(value)
                ? 'fill-[#C9A84C] text-[#C9A84C]'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ProductDetailClient({ product }) {
  const router = useRouter()
  const { data: session } = useSession()
  const { addItem } = useCart()
  const { has: hasFav, toggle: toggleFav } = useWishlist()
  const [qty, setQty] = useState(1)
  const [selImg, setSelImg] = useState(0)
  const [added, setAdded] = useState(false)

  // Variants (خيارات المنتج)
  const hasVariants = !!product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState(
    hasVariants ? product.variants[0].id : ''
  )
  const selectedVariant = hasVariants
    ? (product.variants.find((v) => v.id === selectedVariantId) || product.variants[0])
    : null

  const effectivePrice = selectedVariant && selectedVariant.price > 0
    ? selectedVariant.price
    : product.price
  const effectiveStock = hasVariants ? (selectedVariant?.stock || 0) : (product.stock || 0)
  const outOfStock = effectiveStock <= 0

  const isFav = hasFav(product.id)

  // Reset qty when variant changes (prevent out-of-range qty)
  useEffect(() => {
    if (qty > effectiveStock && effectiveStock > 0) setQty(1)
  }, [selectedVariantId]) // eslint-disable-line

  const onToggleFav = async () => {
    const r = await toggleFav(product.id)
    if (!r.ok && r.needLogin) {
      router.push(`/login?callbackUrl=/store/${product.id}`)
    }
  }

  // Reviews state
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [rating, setRating] = useState(Number(product.rating || 0))
  const [reviewCount, setReviewCount] = useState(Number(product.reviewCount || 0))
  const [myStatus, setMyStatus] = useState(null)
  const [newRating, setNewRating] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitErr, setSubmitErr] = useState('')

  // Related products
  const [related, setRelated] = useState([])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`/api/products/${product.id}/reviews`).then((r) => r.json()),
          fetch(`/api/products/${product.id}/my-review-status`).then((r) => r.json()),
          fetch(`/api/products/${product.id}/related`).then((r) => r.json()),
        ])
        if (ignore) return
        setReviews(r1?.reviews || [])
        setMyStatus(r2 || null)
        setRelated(r3?.products || [])
      } catch (e) {
        /* noop */
      } finally {
        if (!ignore) setReviewsLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [product.id, session?.user?.id])

  const imgs = product.images && product.images.length > 0 ? product.images : []

  const handleAdd = () => {
    addItem(product, qty, selectedVariant)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }
  const buyNow = () => {
    addItem(product, qty, selectedVariant)
    router.push('/store/cart')
  }

  const submitReview = async () => {
    setSubmitMsg(''); setSubmitErr('')
    if (newRating < 1 || newRating > 5) {
      setSubmitErr('يرجى اختيار التقييم أولاً (1-5 نجوم)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating, comment: newComment }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitErr(data?.error || 'حدث خطأ أثناء إرسال التقييم')
      } else {
        setSubmitMsg('تم إرسال تقييمك بنجاح، شكراً لك!')
        setNewRating(0); setNewComment('')
        // Optimistically update UI
        if (data?.product) {
          setRating(data.product.rating)
          setReviewCount(data.product.reviewCount)
        }
        // Refetch reviews + status
        const [r1, r2] = await Promise.all([
          fetch(`/api/products/${product.id}/reviews`).then((r) => r.json()),
          fetch(`/api/products/${product.id}/my-review-status`).then((r) => r.json()),
        ])
        setReviews(r1?.reviews || [])
        setMyStatus(r2 || null)
      }
    } catch (e) {
      setSubmitErr('تعذّر الاتصال، حاول مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[#F8F9FA] py-8">
      <div className="container mx-auto max-w-6xl px-4">
        <nav className="mb-4 flex items-center gap-1 text-xs text-gray-500">
          <Link href="/store" className="hover:text-[#1B3A6B]">المتجر</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-700">{product.nameAr}</span>
        </nav>

        <div className="grid gap-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr]">
          {/* Gallery */}
          <div>
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-bl from-[#F8F9FA] to-white">
              {imgs[selImg] ? (
                <img src={imgs[selImg]} alt={product.nameAr} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-8xl opacity-70">
                  {categoryEmoji(product.category)}
                </div>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {imgs.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelImg(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 ${
                      i === selImg ? 'border-[#1B3A6B]' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-1 self-start rounded-full bg-[#1B3A6B]/5 px-3 py-1 text-xs font-semibold text-[#1B3A6B]">
              {categoryEmoji(product.category)} {categoryLabel(product.category)}
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-[#1B3A6B] md:text-3xl">
              {product.nameAr}
            </h1>
            {product.nameEn && (
              <div dir="ltr" className="mt-1 text-right text-sm text-gray-400">
                {product.nameEn}
              </div>
            )}

            {reviewCount > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <StarRow value={rating} />
                <span className="font-bold text-gray-800">{rating.toFixed(1)}</span>
                <span className="text-gray-500">({reviewCount} تقييم)</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-400">لا توجد تقييمات بعد</div>
            )}

            <div className="mt-2 inline-flex items-center gap-1 self-start text-xs text-gray-500">
              <StoreIcon className="h-3.5 w-3.5" />
              بواسطة: <span className="font-semibold text-gray-700">{product.vendorName}</span>
            </div>

            <div className="mt-4 rounded-xl bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] p-4 text-white">
              <div className="text-3xl font-extrabold">
                {formatOMR(effectivePrice)}
                <span className="ms-2 text-sm font-medium opacity-80">ريال عماني</span>
              </div>
              <div className="mt-1 text-[11px] opacity-80">خصم العضوية يُطبّق عند إتمام الطلب</div>
            </div>

            {product.description && (
              <div className="mt-4">
                <h2 className="mb-1.5 text-sm font-bold text-[#1B3A6B]">الوصف</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {product.description}
                </p>
              </div>
            )}

            {/* Variants selector (خيارات المنتج) */}
            {hasVariants && (
              <div className="mt-4">
                <h2 className="mb-1.5 text-sm font-bold text-[#1B3A6B]">اختر الخيار</h2>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const active = v.id === selectedVariantId
                    const vOut = (v.stock || 0) <= 0
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={vOut}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`group inline-flex min-w-[100px] flex-col items-center rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#1B3A6B]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#1B3A6B]'
                        }`}
                      >
                        <span className="text-sm font-bold">{v.name}</span>
                        {v.price > 0 && v.price !== product.price && (
                          <span className="mt-0.5 text-xs font-medium text-[#C9A84C]">{formatOMR(v.price)} ر.ع</span>
                        )}
                        {v.sku && (
                          <span dir="ltr" className="mt-0.5 text-[10px] text-gray-400">SKU: {v.sku}</span>
                        )}
                        {vOut && (
                          <span className="mt-0.5 text-[10px] font-bold text-red-500">نفد</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-gray-500" />
              {outOfStock ? (
                <span className="font-semibold text-red-600">نفد المخزون</span>
              ) : (
                <span className="text-gray-700">
                  {hasVariants && selectedVariant ? (
                    <>متوفر من "{selectedVariant.name}": <b>{effectiveStock}</b> قطعة</>
                  ) : (
                    <>متوفر: <b>{effectiveStock}</b> قطعة</>
                  )}
                </span>
              )}
            </div>

            {!outOfStock && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="w-16 rounded-lg border border-gray-300 bg-white py-2 text-center font-bold">
                  {qty}
                </div>
                <button
                  onClick={() => setQty((n) => Math.min(effectiveStock || 99, n + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleAdd}
                disabled={outOfStock}
                className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  added
                    ? 'bg-green-600 text-white'
                    : 'bg-[#C9A84C] text-[#1B3A6B] hover:bg-[#b89440]'
                }`}
              >
                {added ? (
                  <><CheckCircle2 className="h-4 w-4" /> تمت الإضافة</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> أضف إلى السلة</>
                )}
              </button>
              <button
                onClick={buyNow}
                disabled={outOfStock}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B3A6B] py-3 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
              >
                اشترِ الآن
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={onToggleFav}
              className={`mt-3 inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                isFav
                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFav ? 'fill-red-500' : ''}`} />
              {isFav ? 'في المفضلة — اضغط للإزالة' : 'أضف إلى المفضلة'}
            </button>
          </div>
        </div>

        {/* ====================== Reviews Section ====================== */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#1B3A6B]" />
              <h2 className="text-lg font-extrabold text-[#1B3A6B]">
                تقييمات العملاء
              </h2>
              {reviewCount > 0 && (
                <span className="rounded-full bg-[#1B3A6B]/5 px-2.5 py-0.5 text-xs font-semibold text-[#1B3A6B]">
                  {reviewCount}
                </span>
              )}
            </div>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <StarRow value={rating} size="h-5 w-5" />
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#1B3A6B]">{rating.toFixed(1)}</div>
                  <div className="text-[10px] text-gray-500">من 5</div>
                </div>
              </div>
            )}
          </div>

          {/* Submission form / eligibility messages */}
          {!session && (
            <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              <Link href={`/login?callbackUrl=/store/${product.id}`} className="inline-flex items-center gap-1.5 font-semibold text-[#1B3A6B] hover:underline">
                <Lock className="h-4 w-4" /> سجّل الدخول لتتمكن من إضافة تقييم
              </Link>
            </div>
          )}

          {session && myStatus && (
            <>
              {myStatus.isOwnProduct ? (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  لا يمكنك تقييم منتجك الخاص.
                </div>
              ) : myStatus.alreadyReviewed ? (
                <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800">
                    <CheckCircle2 className="h-4 w-4" /> لقد قمت بتقييم هذا المنتج مسبقاً
                  </div>
                  {myStatus.myReview && (
                    <div className="flex items-center gap-2 text-sm">
                      <StarRow value={myStatus.myReview.rating} />
                      <span className="text-gray-700">{myStatus.myReview.rating}/5</span>
                      {myStatus.myReview.comment && (
                        <span className="text-gray-600">— {myStatus.myReview.comment}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : !myStatus.hasPurchased ? (
                <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  يمكنك تقييم هذا المنتج بعد شرائه من المتجر.
                </div>
              ) : (
                <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-2 text-sm font-bold text-[#1B3A6B]">أضف تقييمك</div>
                  <div className="mb-3 flex items-center gap-2">
                    <StarRow value={newRating} size="h-7 w-7" interactive onChange={setNewRating} />
                    <span className="text-xs text-gray-500">{newRating ? `${newRating}/5` : 'اختر عدد النجوم'}</span>
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value.slice(0, 1000))}
                    placeholder="اكتب تجربتك مع المنتج (اختياري)"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-[#1B3A6B]"
                  />
                  <div className="mt-1 text-left text-[10px] text-gray-400">{newComment.length}/1000</div>
                  {submitErr && (
                    <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{submitErr}</div>
                  )}
                  {submitMsg && (
                    <div className="mb-2 rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700">{submitMsg}</div>
                  )}
                  <button
                    onClick={submitReview}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1B3A6B] hover:bg-[#b89440] disabled:opacity-50"
                  >
                    {submitting ? 'جارٍ الإرسال...' : 'إرسال التقييم'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Reviews list */}
          {reviewsLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">جارٍ التحميل...</div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              لا توجد تقييمات بعد — كن أول من يقيّم هذا المنتج!
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {r.clientPhoto ? (
                        <img src={r.clientPhoto} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B3A6B] text-xs font-bold text-white">
                          {(r.clientName || '?').charAt(0)}
                        </div>
                      )}
                      <div className="text-sm font-bold text-gray-800">{r.clientName}</div>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <StarRow value={r.rating} size="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold text-gray-600">{r.rating}/5</span>
                  </div>
                  {r.comment && (
                    <p className="text-sm leading-relaxed text-gray-700">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ====================== Related Products ====================== */}
        {related.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#C9A84C]" />
              <h2 className="text-lg font-extrabold text-[#1B3A6B]">قد يعجبك أيضاً</h2>
              <span className="rounded-full bg-[#C9A84C]/20 px-2.5 py-0.5 text-xs font-semibold text-[#8a6f2d]">
                {related.length}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
