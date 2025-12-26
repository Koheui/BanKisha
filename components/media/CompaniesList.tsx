'use client'

import { useEffect, useState } from 'react'
import { getCompanies, getArticles } from '@/src/lib/firestore'
import type { Company, Article } from '@/src/types'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BuildingIcon, FileTextIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react'

interface CompanyWithArticleCount extends Company {
  articleCount: number
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<CompanyWithArticleCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      setError(null)

      const [companiesData, publicArticles] = await Promise.all([
        getCompanies(),
        getArticles('public'),
      ])

      // 公開記事がある企業のみを表示
      const companiesWithArticles = companiesData
        .map((company) => {
          const articleCount = publicArticles.filter(
            (article) => article.companyId === company.id
          ).length
          return { ...company, articleCount }
        })
        .filter((company) => company.articleCount > 0)
        .sort((a, b) => b.articleCount - a.articleCount)

      setCompanies(companiesWithArticles)
    } catch (err: any) {
      console.error('Error loading companies:', err)
      setError(err?.message || '企業一覧の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <CardTitle className="text-center text-red-800 dark:text-red-300">
            エラーが発生しました
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (companies.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <BuildingIcon className="w-8 h-8 text-gray-400" />
          </div>
          <CardTitle className="text-center">まだ企業がありません</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {companies.map((company) => (
        <Link key={company.id} href={`/media/companies/${company.id}`}>
          <Card className="group hover:shadow-lg transition-all duration-300 h-full">
            <CardHeader className="text-center">
              {company.logoUrl ? (
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <Image
                    src={company.logoUrl}
                    alt={company.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BuildingIcon className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <CardTitle className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {company.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileTextIcon className="w-4 h-4" />
                <span>{company.articleCount} 記事</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}


