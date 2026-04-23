import { notFound } from 'next/navigation'
import { connectDB } from '@/lib/db'
import { Product, User } from '@/lib/models'
import ProductDetailClient from './_ProductDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }) {
  await connectDB()
  const p = await Product.findById(params.id).lean()
  if (!p || !p.isActive) notFound()
  const vendor = await User.findById(p.vendorId)
    .select({ _id: 1, name: 1, role: 1 })
    .lean()

  const product = {
    id: p._id,
    ...p,
    _id: undefined,
    vendorName: vendor?.name || 'تاجر',
    vendor: vendor ? { id: vendor._id, name: vendor.name } : null,
  }
  return <ProductDetailClient product={product} />
}
