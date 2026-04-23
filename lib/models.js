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
    password: { type: String, required: true },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

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
      enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    paymentProvider: {
      type: String,
      enum: ['MOCK', 'THAWANI', 'STRIPE'],
      default: 'MOCK',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    paymentId: { type: String, default: '' },
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
