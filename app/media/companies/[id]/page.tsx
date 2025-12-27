import { Suspense } from 'react'
import { CompanyProfile } from '@/components/media/CompanyProfile'
import { CompanyArticles } from '@/components/media/CompanyArticles'
import { getCompany, getArticles } from '@/src/lib/firestore'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { LoaderIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

interface CompanyPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { id } = await params
  const company = await getCompany(id)

  if (!company) {
    return {
      title: '企業が見つかりません | BanKisha-Kawaraban（番記者瓦版）',
    }
  }

  return {
    title: `${company.name} | BanKisha-Kawaraban（番記者瓦版）`,
    description: `${company.name}の記事一覧ページです。`,
  }
}

export default async function MediaCompanyPage({ params }: CompanyPageProps) {
  const { id } = await params
  const company = await getCompany(id)

  if (!company) {
    notFound()
  }

  const articles = await getArticles({ status: 'public', companyId: id })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <CompanyProfile company={company} />
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {company.name}の記事
        </h2>
        <CompanyArticles articles={articles} />
      </div>
    </div>
  )
}

