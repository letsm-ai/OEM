import { notFound } from 'next/navigation'
import { connectDB } from '@/lib/db'
import { User, Product } from '@/lib/models'
import VendorStorefront from './_VendorStorefront'

export const dynamic = 'force-dynamic'

export default async function VendorStorePage({ params }) {
  await connectDB()
  const slug = decodeURIComponent(params.slug || '')
  const vendor = await User.findOne({
    'vendorProfile.slug': slug,
    role: { $in: ['VENDOR', 'ADMIN'] },
  }).lean()
  if (!vendor) notFound()

  const products = await Product.find({
    vendorId: vendor._id,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  const vp = vendor.vendorProfile || {}
  const vendorData = {
    id: vendor._id,
    name: vendor.name,
    slug: vp.slug,
    businessName: vp.businessName || vendor.name,
    tagline: vp.tagline || '',
    bio: vp.bio || '',
    banner: vp.banner || '',
    logo: vp.logo || '',
    phone: vp.phone || '',
    whatsapp: vp.whatsapp || '',
    instagram: vp.instagram || '',
    website: vp.website || '',
    governorate: vp.governorate || '',
    city: vp.city || '',
    address: vp.address || '',
    membershipTier: vendor.membershipTier,
    memberSince: vendor.createdAt,
  }
  const productsData = products.map((p) => ({
    id: p._id,
    ...p,
    _id: undefined,
    vendorName: vendorData.businessName,
    vendorSlug: vp.slug,
    vendorLogo: vp.logo,
  }))

  return <VendorStorefront vendor={vendorData} products={productsData} />
}
