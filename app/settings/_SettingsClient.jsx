'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  User as UserIcon,
  Mail,
  Phone,
  Camera,
  Trash2,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Upload,
} from 'lucide-react'

/** Compress image file to a data URL with max dimension & quality */
async function fileToCompressedDataUrl(file, maxDim = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const { width, height } = img
        const scale = Math.min(1, maxDim / Math.max(width, height))
        const w = Math.round(width * scale)
        const h = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SettingsClient({ initial }) {
  return (
    <div className="space-y-6">
      <ProfileSection initial={initial} />
      <PasswordSection />
      <DangerSection role={initial.role} />
    </div>
  )
}

/* -------------------- PROFILE -------------------- */
function ProfileSection({ initial }) {
  const router = useRouter()
  const { update } = useSession()
  const fileRef = useRef(null)
  const [name, setName] = useState(initial.name || '')
  const [phone, setPhone] = useState(initial.phone || '')
  const [photo, setPhoto] = useState(initial.photo || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null) // {type:'success'|'error', text}

  const onPick = () => fileRef.current?.click()

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type)) {
      setMsg({ type: 'error', text: 'الصيغة المدعومة: PNG, JPEG, WebP, GIF' })
      return
    }
    if (f.size > 6 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'الحد الأقصى 6MB (سيتم ضغطها)' })
    }
    setUploading(true)
    setMsg(null)
    try {
      const dataUrl = await fileToCompressedDataUrl(f, 512, 0.85)
      setPhoto(dataUrl)
    } catch {
      setMsg({ type: 'error', text: 'تعذر قراءة الصورة' })
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = () => setPhoto('')

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, photo }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMsg({ type: 'error', text: data.error || 'تعذر حفظ التغييرات' })
      return
    }
    setMsg({ type: 'success', text: 'تم حفظ التغييرات بنجاح' })
    // Refresh NextAuth session (name in navbar) and server components
    await update()
    router.refresh()
  }

  const dirty =
    name.trim() !== (initial.name || '').trim() ||
    phone.trim() !== (initial.phone || '').trim() ||
    photo !== (initial.photo || '')

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-[#1B3A6B]" />
        <h2 className="text-lg font-bold text-[#1B3A6B]">الملف الشخصي</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-[#F8F9FA] bg-gradient-to-bl from-[#1B3A6B] to-[#152c52] text-3xl font-bold text-[#C9A84C] shadow-sm">
              {photo ? (
                <img src={photo} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span>{(name || '؟').charAt(0)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={onPick}
              disabled={uploading}
              className="absolute -bottom-1 -left-1 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#C9A84C] text-[#1B3A6B] shadow hover:bg-[#b89440] disabled:opacity-60"
              title="تحميل صورة"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          {photo && (
            <button
              type="button"
              onClick={removePhoto}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" /> إزالة الصورة
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFile}
            className="hidden"
          />
          <p className="max-w-[160px] text-center text-[11px] leading-relaxed text-gray-500">
            سيتم تصغير الصورة تلقائياً
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <Field
            label="الاسم الكامل"
            icon={<UserIcon className="h-4 w-4" />}
            value={name}
            onChange={setName}
            placeholder="اسمك الثلاثي"
            required
          />
          <Field
            label="البريد الإلكتروني"
            icon={<Mail className="h-4 w-4" />}
            value={initial.email}
            onChange={() => {}}
            readOnly
            hint="لا يمكن تغيير البريد الإلكتروني"
          />
          <Field
            label="رقم الهاتف (اختياري)"
            icon={<Phone className="h-4 w-4" />}
            value={phone}
            onChange={setPhone}
            placeholder="+968 9XXX XXXX"
            dir="ltr"
          />

          {msg && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                msg.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {msg.text}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving || !dirty || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  حفظ التغييرات
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, icon, value, onChange, placeholder, readOnly, required, hint, dir }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        dir={dir}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3A6B]/10 ${
          readOnly
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500'
            : 'border-gray-300 focus:border-[#1B3A6B]'
        }`}
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/* -------------------- PASSWORD -------------------- */
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmNext, setConfirmNext] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!current || !next || !confirmNext) {
      return setMsg({ type: 'error', text: 'جميع الحقول مطلوبة' })
    }
    if (next.length < 6) {
      return setMsg({ type: 'error', text: 'كلمة المرور الجديدة 6 أحرف على الأقل' })
    }
    if (next !== confirmNext) {
      return setMsg({ type: 'error', text: 'كلمتا المرور الجديدتان غير متطابقتين' })
    }
    setLoading(true)
    const res = await fetch('/api/me/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setMsg({ type: 'error', text: data.error || 'تعذر تحديث كلمة المرور' })
    setMsg({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح' })
    setCurrent('')
    setNext('')
    setConfirmNext('')
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[#1B3A6B]" />
        <h2 className="text-lg font-bold text-[#1B3A6B]">تغيير كلمة المرور</h2>
      </div>

      <form onSubmit={submit} className="max-w-md space-y-4">
        <PasswordField
          label="كلمة المرور الحالية"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          label="كلمة المرور الجديدة"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="6 أحرف على الأقل"
        />
        <PasswordField
          label="تأكيد كلمة المرور الجديدة"
          value={confirmNext}
          onChange={setConfirmNext}
          autoComplete="new-password"
        />

        {msg && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              msg.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#152c52] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحديث...
            </>
          ) : (
            'تحديث كلمة المرور'
          )}
        </button>
      </form>
    </section>
  )
}

function PasswordField({ label, value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pe-20 text-sm outline-none focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 left-2 my-auto h-7 rounded-md px-2 text-xs font-medium text-[#1B3A6B] hover:bg-[#F8F9FA]"
        >
          {show ? 'إخفاء' : 'إظهار'}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/* -------------------- DANGER ZONE -------------------- */
function DangerSection({ role }) {
  const [open, setOpen] = useState(false)
  const isAdmin = role === 'ADMIN'

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-bold text-red-700">منطقة الخطر</h2>
      </div>
      <p className="mb-4 text-sm text-red-800/80">
        حذف الحساب إجراء نهائي ولا يمكن التراجع عنه. سيتم حذف بياناتك الشخصية،
        شركاتك، سجلّ خبيرك، وأوقات توفرك. سيتم إلغاء حجوزاتك المستقبلية تلقائياً.
      </p>
      {isAdmin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          لا يمكن حذف حساب المسؤول من هذه الصفحة لأسباب أمنية.
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          حذف الحساب
        </button>
      )}

      {open && <DeleteModal onClose={() => setOpen(false)} />}
    </section>
  )
}

function DeleteModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!password) return setError('كلمة المرور مطلوبة')
    if (confirm !== 'حذف' && confirm !== 'DELETE') {
      return setError('يجب كتابة كلمة "حذف" لتأكيد العملية')
    }
    setLoading(true)
    const res = await fetch('/api/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return setError(data.error || 'تعذر حذف الحساب')
    // Sign out and redirect to home
    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-base font-bold text-red-800">تأكيد حذف الحساب</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-red-700/70 hover:bg-red-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
            هذا الإجراء <strong>نهائي وغير قابل للتراجع</strong>. لن تتمكن من استعادة حسابك
            أو أي من بياناتك.
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              اكتب <span className="font-bold text-red-600">حذف</span> للتأكيد
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="حذف"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  نعم، احذف حسابي
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
