import { connectDB } from '@/lib/db'
import { Product, User } from '@/lib/models'
import StoreClient from './_StoreClient'
import { CATEGORY_KEYS } from '@/lib/store'

export const dynamic = 'force-dynamic'

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { salesCount: -1 },
}

export default async function StorePage({ searchParams }) {
  const params = searchParams || {}
  const search = (params.search || '').toString().trim()
  const category = CATEGORY_KEYS.includes(params.category) ? params.category : ''
  const sort = SORT_MAP[params.sort] ? params.sort : 'newest'

  await connectDB()
  const q = { isActive: true }
  if (category) q.category = category
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    q.$or = [{ nameAr: rx }, { nameEn: rx }, { description: rx }]
  }
  const products = await Product.find(q).sort(SORT_MAP[sort]).limit(200).lean()
  const vendorIds = Array.from(new Set(products.map((p) => p.vendorId)))
  const vendors = await User.find({
    _id: { $in: vendorIds },
    role: { $in: ['VENDOR', 'ADMIN'] },
  })
    .select({ _id: 1, name: 1 })
    .lean()
  const vendorMap = Object.fromEntries(vendors.map((v) => [v._id, v.name]))

  const mapped = products
    .filter((p) => vendorMap[p.vendorId])
    .map((p) => ({
      id: p._id,
      ...p,
      _id: undefined,
      vendorName: vendorMap[p.vendorId] || 'تاجر',
    }))

  return <StoreClient initialProducts={mapped} />
}
