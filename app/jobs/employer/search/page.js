import EmployerSearchClient from './_EmployerSearchClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'البحث عن مرشحين — فرص العمل',
}

export default function Page() {
  return <EmployerSearchClient />
}
