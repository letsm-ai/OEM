import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const { Schema, models, model } = mongoose

/* =========================
   USER
   ========================= */
const UserSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      default: '',
      // Required only for non-guest users (guest checkout creates an empty-password user)
      validate: {
        validator: function (v) {
          if (this.isGuest) return true
          return typeof v === 'string' && v.length > 0
        },
        message: 'Password is required for non-guest users',
      },
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER', 'VENDOR', 'EXPERT'],
      default: 'MEMBER',
    },
    membershipTier: {
      type: String,
      enum: ['FREE', 'BASIC', 'GOLD', 'PLATINUM'],
      default: 'FREE',
    },
    membershipExpiry: { type: Date, default: null },
    phone: { type: String, default: '' },
    photo: { type: String, default: '' }, // base64 data URL
    wishlist: { type: [String], default: [] }, // array of productIds
    isGuest: { type: Boolean, default: false }, // guest checkout — no password
    vendorProfile: {
      slug: { type: String, default: '', index: true },
      businessName: { type: String, default: '' },
      tagline: { type: String, default: '' },
      bio: { type: String, default: '' },
      banner: { type: String, default: '' }, // base64 data URL
      logo: { type: String, default: '' },   // base64 data URL
      phone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      instagram: { type: String, default: '' },
      website: { type: String, default: '' },
      governorate: { type: String, default: '' },
      city: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   COMPANY
   ========================= */
const CompanySchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true, index: true },
    nameAr: { type: String, required: true },
    nameEn: { type: String },
    sector: {
      type: String,
      enum: [
        'TECH',
        'MARKETING',
        'FOOD',
        'CONSULTING',
        'TRADE',
        'HEALTH',
        'EDUCATION',
        'REAL_ESTATE',
        'INDUSTRY',
        'SERVICES',
      ],
      required: true,
    },
    description: { type: String },
    services: { type: [String], default: [] },
    logo: { type: String }, // base64 data URL
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    location: { type: String }, // free-text, used in Google Maps embed query
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    governorate: {
      type: String,
      enum: [
        'MUSCAT',
        'DHOFAR',
        'MUSANDAM',
        'BURAIMI',
        'DAKHILIYAH',
        'SHARQIYAH',
        'WUSTA',
        'BATINAH',
        'DHAHIRAH',
      ],
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String, default: null },
    isApproved: { type: Boolean, default: false }, // legacy flag kept in sync with status
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   PRODUCT
   ========================= */
const ProductSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    vendorId: { type: String, ref: 'User', required: true, index: true },
    nameAr: { type: String, required: true },
    nameEn: { type: String, default: '' },
    price: { type: Number, required: true, default: 0 },
    description: { type: String, default: '' },
    images: { type: [String], default: [] }, // base64 data URLs (max 5)
    category: {
      type: String,
      enum: [
        'FOOD',
        'FASHION',
        'ELECTRONICS',
        'OFFICE',
        'HANDICRAFT',
        'DIGITAL',
        'OTHER',
      ],
      default: 'OTHER',
      index: true,
    },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    salesCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }, // 0..5, avg of all reviews (rounded 2 dec)
    reviewCount: { type: Number, default: 0 }, // total number of reviews
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   PRODUCT REVIEW
   ========================= */
const ProductReviewSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    productId: { type: String, ref: 'Product', required: true, index: true },
    userId: { type: String, ref: 'User', required: true, index: true },
    orderId: { type: String, ref: 'Order', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true })

/* =========================
   ORDER
   ========================= */
const OrderSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    buyerId: { type: String, ref: 'User', required: true, index: true },
    items: {
      type: [
        {
          productId: String,
          vendorId: String,
          nameAr: String,
          image: String,
          unitPrice: Number,
          quantity: Number,
          lineSubtotal: Number, // unitPrice * quantity (before discount)
        },
      ],
      default: [],
    },
    subtotal: { type: Number, default: 0 }, // sum of line subtotals
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    tierAtPurchase: { type: String, default: 'FREE' },
    couponCode: { type: String, default: '' },
    couponDiscount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    commissionPercent: { type: Number, default: 5 },
    commissionAmount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 }, // subtotal - discount
    shippingAddress: {
      name: String,
      phone: String,
      governorate: String,
      city: String,
      addressLine: String,
      notes: String,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    paymentProvider: { type: String, default: 'MOCK' },
    paymentStatus: { type: String, default: 'PENDING' },
    paymentId: { type: String, default: '' },
    thawaniSessionId: { type: String, default: '', index: true },
    thawaniInvoice: { type: String, default: '' },
    thawaniRedirectUrl: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    paymentProcessedSideEffects: { type: Boolean, default: false }, // flag: stock/coupon/emails done
    statusHistory: {
      type: [
        {
          _id: false,
          status: { type: String },
          changedAt: { type: Date, default: Date.now },
          changedBy: { type: String, default: 'SYSTEM' }, // userId or 'SYSTEM'
          actorName: { type: String, default: '' },
          note: { type: String, default: '' },
        },
      ],
      default: [],
    },
    trackingNumber: { type: String, default: '' },
    carrier: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   ORDER ITEM (legacy, kept for compat — new orders use embedded items[])
   ========================= */
const OrderItemSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    orderId: { type: String, ref: 'Order', required: true },
    productId: { type: String, ref: 'Product', required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
  },
  { _id: false }
)

/* =========================
   VENDOR APPLICATION
   ========================= */
const VendorApplicationSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true, unique: true, index: true },
    businessName: { type: String, required: true },
    businessDescription: { type: String, default: '' },
    phone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    adminNote: { type: String, default: '' },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   EXPERT
   ========================= */
const ExpertSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true, unique: true, index: true },
    specialty: {
      type: String,
      enum: ['LEGAL', 'FINANCIAL', 'MARKETING', 'TECH', 'MANAGEMENT', 'HR'],
      required: true,
    },
    specialtyAr: { type: String, required: true }, // free-text label (can mirror enum label)
    bio: { type: String },
    experienceYears: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 }, // OMR
    photo: { type: String }, // base64
    cv: { type: String }, // base64 or URL
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String, default: null },
    isApproved: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   AVAILABILITY
   ========================= */
const AvailabilitySchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    expertId: { type: String, ref: 'Expert', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true }, // e.g. "09:00"
    endTime: { type: String, required: true },
  },
  { _id: false }
)

/* =========================
   APPOINTMENT
   ========================= */
const AppointmentSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    clientId: { type: String, ref: 'User', required: true, index: true },
    expertId: { type: String, ref: 'Expert', required: true, index: true },
    date: { type: Date, required: true }, // the day (time = 00:00 UTC)
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    totalPaid: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    notes: { type: String },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null }, // 'client' | 'expert' | 'admin'
    reminderSentAt: { type: Date, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
    reviewComment: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   MEMBERSHIP
   ========================= */
const MembershipSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true },
    tier: {
      type: String,
      enum: ['FREE', 'BASIC', 'GOLD', 'PLATINUM'],
      required: true,
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
  },
  { _id: false }
)

/* =========================
   ABANDONED CART (server-side cart persistence for reminders)
   ========================= */
const CartSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true, unique: true, index: true },
    items: {
      type: [
        {
          _id: false,
          productId: String,
          quantity: Number,
          nameAr: String,
          unitPrice: Number,
          image: String,
        },
      ],
      default: [],
    },
    lastReminderSentAt: { type: Date, default: null },
    reminderEmailsSent: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now, index: true },
  },
  { _id: false }
)

/* =========================
   COUPON (discount code)
   ========================= */
const CouponSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    code: { type: String, required: true, unique: true, index: true, uppercase: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['PERCENT', 'FIXED'], default: 'PERCENT' },
    value: { type: Number, required: true, min: 0 }, // percent 1-100 or fixed OMR
    minSubtotal: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }, // 0 = no cap (percent only)
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }, // null = no expiry
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited global
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 }, // 0 = unlimited per user
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: String, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   COUPON REDEMPTION (per-user usage tracker)
   ========================= */
const CouponRedemptionSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    couponId: { type: String, ref: 'Coupon', required: true, index: true },
    code: { type: String, required: true, index: true, uppercase: true },
    userId: { type: String, ref: 'User', required: true, index: true },
    orderId: { type: String, ref: 'Order', required: true, index: true },
    amountSaved: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)
CouponRedemptionSchema.index({ couponId: 1, userId: 1 })

/* =========================
   PASSWORD RESET TOKEN
   ========================= */
const PasswordResetTokenSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true }, // sha256(rawToken)
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

export const User = models.User || model('User', UserSchema)
export const Company = models.Company || model('Company', CompanySchema)
export const Product = models.Product || model('Product', ProductSchema)
export const Cart = models.Cart || model('Cart', CartSchema)
export const ProductReview =
  models.ProductReview || model('ProductReview', ProductReviewSchema)
export const Coupon = models.Coupon || model('Coupon', CouponSchema)
export const CouponRedemption =
  models.CouponRedemption ||
  model('CouponRedemption', CouponRedemptionSchema)
export const Order = models.Order || model('Order', OrderSchema)
export const OrderItem =
  models.OrderItem || model('OrderItem', OrderItemSchema)
export const Expert = models.Expert || model('Expert', ExpertSchema)
export const Availability =
  models.Availability || model('Availability', AvailabilitySchema)
export const Appointment =
  models.Appointment || model('Appointment', AppointmentSchema)
export const Membership =
  models.Membership || model('Membership', MembershipSchema)
export const PasswordResetToken =
  models.PasswordResetToken ||
  model('PasswordResetToken', PasswordResetTokenSchema)
export const VendorApplication =
  models.VendorApplication ||
  model('VendorApplication', VendorApplicationSchema)
