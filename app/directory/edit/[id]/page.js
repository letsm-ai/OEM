import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Company } from '@/lib/models'
import AddCompanyForm from '../../add-company/_AddCompanyForm'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EditCompanyPage({ params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect(`/login?callbackUrl=/directory/edit/${params.id}`)
  }
  await connectDB()
  const company = await Company.findById(params.id).lean()
  if (!company) notFound()
  if (company.userId !== session.user.id && session.user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/directory/my-companies"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#1B3A6B]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة لشركاتي
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B3A6B] md:text-3xl">
          تعديل شركة: {company.nameAr}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          سيتم إعادة مراجعة البيانات بعد التعديل.
        </p>
      </div>
      <AddCompanyForm
        initial={{
          nameAr: company.nameAr,
          nameEn: company.nameEn,
          sector: company.sector,
          governorate: company.governorate,
          description: company.description,
          services: company.services || [],
          phone: company.phone,
          email: company.email,
          website: company.website,
          location: company.location,
          logo: company.logo,
        }}
        companyId={company._id}
      />
    </div>
  )
}
