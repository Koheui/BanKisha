import { Suspense } from 'react'
import { CompanyProfile } from '@/components/media/CompanyProfile'
import { CompanyArticles } from '@/components/media/CompanyArticles'
import { getCompany } from '@/src/lib/firestore'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { LoaderIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Suspense
        fallback={
          <Card>
            <CardContent className="p-8 text-center">
              <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
            </CardContent>
          </Card>
        }
      >
        <CompanyProfile company={company} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {company.name}の記事
          </h2>
          <CompanyArticles companyId={id} />
        </div>
      </Suspense>
    </div>
  )
}

