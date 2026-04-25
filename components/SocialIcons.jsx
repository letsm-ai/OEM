'use client'

import { Instagram, Facebook, Twitter, Linkedin, Youtube, Globe } from 'lucide-react'

/**
 * Reusable icons + small inline display for social links.
 * `links` is an object: { instagram, facebook, twitter, linkedin, whatsapp, tiktok, snapchat, youtube }.
 * Empty fields are skipped. Whatsapp can be either a phone number or a wa.me URL.
 */

// TikTok / Snapchat / Whatsapp don't have lucide icons by default — use small SVGs.
const TikTokIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.6 6.6c-1.3 0-2.5-.5-3.4-1.4-.7-.7-1.1-1.6-1.3-2.5h-2.7v13.5c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .5 0 .8.1V11c-.3 0-.5-.1-.8-.1-2.9 0-5.4 2.4-5.4 5.4S6.6 21.7 9.5 21.7s5.4-2.4 5.4-5.4V9.6c1.2.9 2.7 1.4 4.4 1.4V8.3c-.7 0-1.4-.6-1.4-1.4s.7-.3 1.7-.3z"/>
  </svg>
)
const SnapchatIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C8 2 7 5 7 6.6v3.5c-.4-.2-.7-.2-1-.2-.6 0-1.4.4-1.4 1.1 0 .8.8 1.1 1.4 1.4.4.2.9.4 1 .7-.5 1.6-2 3.2-3.7 3.5-.4 0-.5.4-.4.7.5 1 1.8 1.5 3 1.7 0 .5.1 1.2.6 1.4.4.2 1 .1 1.6-.1.6-.2 1.4-.5 2.5-.3 1 .2 1.7.8 2.4 1.3.6.5 1.2 1 2 1s1.4-.5 2-1c.7-.5 1.4-1.1 2.4-1.3 1.1-.2 1.9.1 2.5.3.6.2 1.2.3 1.6.1.5-.2.6-.9.6-1.4 1.2-.2 2.5-.7 3-1.7.1-.3 0-.7-.4-.7-1.7-.3-3.2-1.9-3.7-3.5.1-.3.6-.5 1-.7.6-.3 1.4-.6 1.4-1.4 0-.7-.8-1.1-1.4-1.1-.3 0-.6 0-1 .2V6.6C17 5 16 2 12 2z"/>
  </svg>
)
const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
  </svg>
)

function isValid(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function whatsappHref(v) {
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  const digits = v.replace(/[^0-9]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export const SOCIAL_DEFINITIONS = [
  { key: 'instagram', label: 'إنستغرام', Icon: Instagram, color: 'hover:bg-gradient-to-br hover:from-pink-500 hover:to-orange-500 hover:text-white hover:border-transparent' },
  { key: 'facebook',  label: 'فيسبوك',   Icon: Facebook,  color: 'hover:bg-[#1877F2] hover:text-white hover:border-transparent' },
  { key: 'twitter',   label: 'تويتر/X',  Icon: Twitter,   color: 'hover:bg-black hover:text-white hover:border-transparent' },
  { key: 'linkedin',  label: 'لينكدإن',  Icon: Linkedin,  color: 'hover:bg-[#0A66C2] hover:text-white hover:border-transparent' },
  { key: 'whatsapp',  label: 'واتساب',   Icon: WhatsAppIcon, color: 'hover:bg-[#25D366] hover:text-white hover:border-transparent' },
  { key: 'tiktok',    label: 'تيك توك',  Icon: TikTokIcon, color: 'hover:bg-black hover:text-white hover:border-transparent' },
  { key: 'snapchat',  label: 'سناب شات', Icon: SnapchatIcon, color: 'hover:bg-[#FFFC00] hover:text-black hover:border-transparent' },
  { key: 'youtube',   label: 'يوتيوب',   Icon: Youtube,   color: 'hover:bg-[#FF0000] hover:text-white hover:border-transparent' },
]

/**
 * SocialIcons — render small clickable icons for each provided link.
 * size: 'sm' | 'md' | 'lg'
 */
export default function SocialIcons({ links = {}, size = 'md', className = '', extraWebsite = '' }) {
  if (!links && !extraWebsite) return null
  const sizes = {
    sm: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
    md: { box: 'h-9 w-9', icon: 'h-4 w-4' },
    lg: { box: 'h-11 w-11', icon: 'h-5 w-5' },
  }
  const s = sizes[size] || sizes.md
  const items = []
  for (const def of SOCIAL_DEFINITIONS) {
    const v = links?.[def.key]
    if (!isValid(v)) continue
    const href = def.key === 'whatsapp' ? whatsappHref(v) : v
    if (!href) continue
    items.push({ ...def, href })
  }
  if (isValid(extraWebsite)) {
    items.push({
      key: 'website',
      label: 'الموقع الإلكتروني',
      Icon: Globe,
      color: 'hover:bg-[#1B3A6B] hover:text-white hover:border-transparent',
      href: /^https?:\/\//i.test(extraWebsite) ? extraWebsite : `https://${extraWebsite}`,
    })
  }
  if (items.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map(({ key, label, Icon, color, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex ${s.box} items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition ${color}`}
        >
          <Icon className={s.icon} />
        </a>
      ))}
    </div>
  )
}

/**
 * SocialFormFields — reusable input fields for capturing social media URLs.
 * Used in vendor / company / expert profile forms.
 */
export function SocialFormFields({ value = {}, onChange }) {
  const set = (key) => (e) => {
    onChange?.({ ...value, [key]: e.target.value })
  }
  const placeholders = {
    instagram: 'https://www.instagram.com/yourhandle/  أو  @yourhandle',
    facebook:  'https://www.facebook.com/yourpage',
    twitter:   'https://twitter.com/yourhandle  أو  @yourhandle',
    linkedin:  'https://www.linkedin.com/in/yourname',
    whatsapp:  '+96891234567  أو  https://wa.me/96891234567',
    tiktok:    'https://www.tiktok.com/@yourhandle  أو  @yourhandle',
    snapchat:  'https://www.snapchat.com/add/yourhandle  أو  @yourhandle',
    youtube:   'https://www.youtube.com/@channel',
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SOCIAL_DEFINITIONS.map(({ key, label, Icon }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Icon className="h-3.5 w-3.5 text-gray-500" /> {label}
          </span>
          <input
            type="text"
            value={value?.[key] || ''}
            onChange={set(key)}
            placeholder={placeholders[key]}
            dir="ltr"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#1B3A6B] focus:outline-none"
          />
        </label>
      ))}
    </div>
  )
}
