/**
 * Vendor public + private profile endpoints.
 *   GET /vendors             — public list
 *   GET /vendors/:slug       — public storefront
 *   GET /vendor/profile      — auth (vendor/admin)
 *   PUT /vendor/profile      — auth (vendor/admin)
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User, Product } from '@/lib/models'
import { slugify, uniqueVendorSlug } from '@/lib/slug'
import { sanitizeSocial } from '@/lib/social'
import { json, err, requireAuth } from './_helpers'

export async function handleVendorsList() {
  await connectDB()
  const vendors = await User.find({
    role: { $in: ['VENDOR', 'ADMIN'] },
    'vendorProfile.slug': { $ne: '' },
  })
    .select({ _id: 1, name: 1, vendorProfile: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
  const ids = vendors.map((v) => v._id)
  const counts = await Product.aggregate([
    { $match: { vendorId: { $in: ids }, isActive: true } },
    { $group: { _id: '$vendorId', count: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]))
  return json({
    vendors: vendors
      .filter((v) => (countMap[v._id] || 0) > 0)
      .map((v) => ({
        id: v._id,
        name: v.name,
        slug: v.vendorProfile?.slug || '',
        businessName: v.vendorProfile?.businessName || v.name,
        tagline: v.vendorProfile?.tagline || '',
        logo: v.vendorProfile?.logo || '',
        banner: v.vendorProfile?.banner || '',
        governorate: v.vendorProfile?.governorate || '',
        city: v.vendorProfile?.city || '',
        productCount: countMap[v._id] || 0,
      })),
  })
}

export async function handleVendorStorefront(slug) {
  await connectDB()
  const decodedSlug = decodeURIComponent(slug)
  const vendor = await User.findOne({
    'vendorProfile.slug': decodedSlug,
    role: { $in: ['VENDOR', 'ADMIN'] },
  })
    .select({
      _id: 1,
      name: 1,
      vendorProfile: 1,
      createdAt: 1,
      membershipTier: 1,
    })
    .lean()
  if (!vendor) return err('المتجر غير موجود', 404)
  const products = await Product.find({
    vendorId: vendor._id,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()
  return json({
    vendor: {
      id: vendor._id,
      name: vendor.name,
      slug: vendor.vendorProfile?.slug,
      businessName: vendor.vendorProfile?.businessName || vendor.name,
      tagline: vendor.vendorProfile?.tagline || '',
      bio: vendor.vendorProfile?.bio || '',
      banner: vendor.vendorProfile?.banner || '',
      logo: vendor.vendorProfile?.logo || '',
      phone: vendor.vendorProfile?.phone || '',
      whatsapp: vendor.vendorProfile?.whatsapp || '',
      instagram: vendor.vendorProfile?.instagram || '',
      website: vendor.vendorProfile?.website || '',
      governorate: vendor.vendorProfile?.governorate || '',
      city: vendor.vendorProfile?.city || '',
      address: vendor.vendorProfile?.address || '',
      membershipTier: vendor.membershipTier,
      memberSince: vendor.createdAt,
    },
    products: products.map((p) => ({
      id: p._id,
      ...p,
      _id: undefined,
      vendorName: vendor.name,
    })),
  })
}

export async function handleVendorProfileGet() {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (user?.role !== 'VENDOR' && user?.role !== 'ADMIN') {
    return err('صلاحيات بائع مطلوبة', 403)
  }
  return json({
    profile: {
      id: user._id,
      name: user.name,
      email: user.email,
      slug: user.vendorProfile?.slug || '',
      businessName: user.vendorProfile?.businessName || user.name,
      tagline: user.vendorProfile?.tagline || '',
      bio: user.vendorProfile?.bio || '',
      banner: user.vendorProfile?.banner || '',
      logo: user.vendorProfile?.logo || '',
      phone: user.vendorProfile?.phone || '',
      whatsapp: user.vendorProfile?.whatsapp || '',
      instagram: user.vendorProfile?.instagram || '',
      website: user.vendorProfile?.website || '',
      governorate: user.vendorProfile?.governorate || '',
      city: user.vendorProfile?.city || '',
      address: user.vendorProfile?.address || '',
      social: user.vendorProfile?.social || {
        instagram: '', facebook: '', twitter: '', linkedin: '',
        whatsapp: '', tiktok: '', snapchat: '', youtube: '',
      },
      vendorAbsorbsShipping: user.vendorAbsorbsShipping === true,
    },
  })
}

export async function handleVendorProfileUpdate(request) {
  const session = await getServerSession(authOptions)
  const unauth = requireAuth(session)
  if (unauth) return unauth
  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return err('المستخدم غير موجود', 404)
  if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
    return err('صلاحيات بائع مطلوبة', 403)
  }
  const body = await request.json().catch(() => ({}))
  const prof = user.vendorProfile || {}

  const strFields = {
    businessName: 80, tagline: 160, bio: 3000, phone: 30, whatsapp: 30,
    instagram: 80, website: 200, governorate: 40, city: 60, address: 300,
  }
  for (const [key, cap] of Object.entries(strFields)) {
    if (body[key] !== undefined) {
      prof[key] = String(body[key] || '').trim().slice(0, cap)
    }
  }
  if (prof.businessName && prof.businessName.length < 2) {
    return err('اسم المتجر قصير جداً', 400)
  }

  for (const f of ['banner', 'logo']) {
    if (body[f] !== undefined) {
      const v = body[f]
      if (v === '' || v === null) {
        prof[f] = ''
      } else if (
        typeof v === 'string' &&
        /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) &&
        v.length <= 3_000_000
      ) {
        prof[f] = v
      } else {
        return err('صيغة/حجم الصورة غير مدعوم', 400)
      }
    }
  }

  if (body.slug !== undefined) {
    const desired = slugify(body.slug)
    if (!desired) return err('الرابط غير صالح', 400)
    if (desired.length < 3 || desired.length > 60) {
      return err('الرابط يجب أن يكون بين 3 و 60 حرفاً', 400)
    }
    if (desired !== prof.slug) {
      const collision = await User.findOne({
        'vendorProfile.slug': desired,
        _id: { $ne: user._id },
      }).lean()
      if (collision) return err('هذا الرابط مستخدم، جرّب اسماً آخر', 409)
      prof.slug = desired
    }
  }
  if (!prof.slug) {
    prof.slug = await uniqueVendorSlug(
      User,
      prof.businessName || user.name,
      user._id
    )
  }

  if (body.vendorAbsorbsShipping !== undefined) {
    user.vendorAbsorbsShipping = body.vendorAbsorbsShipping === true
  }
  if (body.social !== undefined) {
    prof.social = sanitizeSocial(body.social)
  }

  user.vendorProfile = prof
  user.updatedAt = new Date()
  await user.save()
  return json({
    success: true,
    profile: {
      ...prof,
      id: user._id,
      name: user.name,
      email: user.email,
      vendorAbsorbsShipping: user.vendorAbsorbsShipping === true,
    },
  })
}
