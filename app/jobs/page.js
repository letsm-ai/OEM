import JobsClient from './_JobsClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'فرص العمل — مجلس رواد الأعمال العماني',
  description: 'استكشف فرص العمل من الشركات العمانية أو انشر إعلان وظيفة',
}

export default function JobsPage() {
  return <JobsClient />
}
