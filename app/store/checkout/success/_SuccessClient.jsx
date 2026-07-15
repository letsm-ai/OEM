'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Package,
  ShoppingBag,
  Home,
} from 'lucide-react'
import { formatOMR } from '@/lib/store'
import { useCart } from '@/components/CartContext'

export default function SuccessClient() {
  const sp = useSearchParams()
  const sessionId = sp.get('session_id')
  const orderId = sp.get('order_id')
  const [state, setState] = useState({ loading: true, paid: false, error: '', order: null })
  const { clear } = useCart()
  const cleared = useRef(false)

  useEffect(() => {
    let cancelled = false
    const verify = async () => {
      try {
        const res = await fetch('/api/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, orderId }),
        })
        const d = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setState({ loading: false, paid: false, error: d.error || 'فشل التحقق من الدفع', order: null })
          return
        }
        setState({ loading: false, paid: !!d.paid, error: '', order: d.order })
        // Clear the cart ONLY after payment is confirmed. If the buyer cancels
        // on Thawani and returns to the cancel page, the cart stays intact.
        if (d.paid && !cleared.current) {
          cleared.current = true
          clear()
        }
      } catch (e) {
        if (!cancelled) setState({ loading: false, paid: false, error: 'تعذّر الاتصال بالخادم', order: null })
      }
    }
    verify()
    return () => { cancelled = true }
  }, [sessionId, orderId, clear])

  if (state.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#1B3A6B]" />
          <div className="text-sm font-semibold text-gray-700">جارٍ التحقق من عملية الدفع...</div>
          <div className="mt-1 text-xs text-gray-500">يرجى عدم إغلاق الصفحة</div>
        </div>
      </div>
    )
  }

  if (!state.paid) {
    return (
      <div className="bg-[#F8F9FA] py-12">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
            <h1 className="mb-2 text-xl font-extrabold text-amber-800">لم يكتمل الدفع بعد</h1>
            <p className="mb-5 text-sm text-amber-700">
              {state.error || 'الدفع قيد المعالجة أو تم إلغاؤه. إذا قمت بالدفع بالفعل، حاول تحديث الصفحة خلال لحظات.'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                تحديث الصفحة
              </button>
              <Link
                href="/store/cart"
                className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                العودة للسلة
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const o = state.order
  return (
    <div className="bg-[#F8F9FA] py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1B3A6B]">تم الدفع بنجاح! 🎉</h1>
            <p className="mt-2 text-sm text-gray-600">شكراً لك، طلبك قيد المعالجة الآن</p>
          </div>

          <div className="space-y-3 rounded-xl bg-[#F8F9FA] p-4 text-sm">
            <SumRow label="رقم الطلب" value={<span dir="ltr" className="font-mono text-xs">{o?.id}</span>} />
            {o?.invoice && (
              <SumRow label="فاتورة Thawani" value={<span dir="ltr" className="font-mono text-xs">{o.invoice}</span>} />
            )}
            {o?.couponCode && <SumRow label="الكوبون المطبّق" value={o.couponCode} color="text-amber-700" />}
            {o?.shippingFee > 0 && (
              <SumRow label="رسوم الشحن" value={`${formatOMR(o.shippingFee)} ر.ع`} />
            )}
            <SumRow
              label="الإجمالي المدفوع"
              value={`${formatOMR(o?.totalPaid || 0)} ر.ع`}
              bold
            />
            <SumRow
              label="عدد المنتجات"
              value={`${(o?.items || []).reduce((s, it) => s + (it.quantity || 0), 0)} قطعة`}
            />
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
            📧 تم إرسال تأكيد الطلب إلى بريدك الإلكتروني — سيتواصل البائعون معك قريباً لترتيب التوصيل.
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/store"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-3 text-sm font-bold text-[#1B3A6B] hover:bg-[#b89440]"
            >
              <ShoppingBag className="h-4 w-4" />
              متابعة التسوق
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:border-[#1B3A6B] hover:text-[#1B3A6B]"
            >
              <Home className="h-4 w-4" />
              الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function SumRow({ label, value, color = 'text-gray-700', bold = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${color} ${bold ? 'text-lg font-extrabold text-[#1B3A6B]' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  )
}
