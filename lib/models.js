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
    vendorId: { type: String, ref: 'User', required: true },
    nameAr: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    description: { type: String },
    images: { type: [String], default: [] },
    category: { type: String },
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   ORDER
   ========================= */
const OrderSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    buyerId: { type: String, ref: 'User', required: true },
    totalAmount: { type: Number, required: true, default: 0 },
    platformCommission: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/* =========================
   ORDER ITEM
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
   EXPERT
   ========================= */
const ExpertSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, ref: 'User', required: true },
    specialtyAr: { type: String, required: true },
    bio: { type: String },
    hourlyRate: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
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
    clientId: { type: String, ref: 'User', required: true },
    expertId: { type: String, ref: 'Expert', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    totalPaid: { type: Number, default: 0 },
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
