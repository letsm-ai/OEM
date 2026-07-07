import UnsubscribeClient from './_UnsubscribeClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'إلغاء الاشتراك — مجلس رواد الأعمال العماني',
  description:
    'إلغاء الاشتراك من قائمة البريد الإلكتروني — مجلس رواد الأعمال العماني.',
}

export default function UnsubscribePage({ searchParams }) {
  const email = (searchParams?.email || '').trim()
  const token = (searchParams?.t || '').trim()
  return <UnsubscribeClient defaultEmail={email} token={token} />
}
