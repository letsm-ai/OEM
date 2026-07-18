import JobDetailClient from './_JobDetailClient'

export const dynamic = 'force-dynamic'

export default function JobDetailPage({ params }) {
  return <JobDetailClient jobId={params.id} />
}
