import BroadcastClient from './_BroadcastClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الرسائل الجماعية — أدمن' }

export default function AdminBroadcastPage() {
  // Auth check is handled by /app/app/admin/layout.js
  return <BroadcastClient />
}
