import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import VendorsListClient from './_VendorsListClient'

export const dynamic = 'force-dynamic'

export default async function VendorsIndexPage() {
  return <VendorsListClient />
}
