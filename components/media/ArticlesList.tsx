'use client'

import { useEffect, useState } from 'react'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { ArticleFilters } from './ArticleFilters'
import { LoaderIcon, AlertCircleIcon, FileTextIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface ArticleWithCompany extends Article {
  company?: Company
}

export function ArticlesList() {
  const [articles, setArticles] = useState<ArticleWithCompany[]>([])
  const [filteredArticles, setFilteredArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      setLoading(true)
      setError(null)

      const [publicArticles, companies] = await Promise.all([
        getArticles('public'),
        getCompanies().catch(() => [] as Company[]),
      ])

      const articlesWithCompany = publicArticles.map((article) => {
        const company = companies.find((c) => c.id === article.companyId)
        return { ...article, company }
      })

      setArticles(articlesWithCompany)
      setFilteredArticles(articlesWithCompany)
    } catch (err: any) {
      console.error('Error loading articles:', err)
      setError(err?.message || '記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleFiltered = (filtered: Article[]) => {
    // 企業情報を保持したままフィルタリング
    const filteredWithCompany = filtered.map((article) => {
      const originalArticle = articles.find((a) => a.id === article.id)
      return originalArticle || article
    })
    setFilteredArticles(filteredWithCompany as ArticleWithCompany[])
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
          <CardDescription className="text-center text-red-700 dark:text-red-400">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (articles.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileTextIcon className="w-8 h-8 text-gray-400" />
          </div>
          <CardTitle className="text-center">まだ記事がありません</CardTitle>
          <CardDescription className="text-center">
            記事が公開されるとこちらに表示されます。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <ArticleFilters articles={articles} onFiltered={handleFiltered} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <ArticleCard key={article.id} article={article} company={article.company} />
        ))}
      </div>
      {filteredArticles.length === 0 && articles.length > 0 && (
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="text-center">該当する記事がありません</CardTitle>
            <CardDescription className="text-center">
              フィルタ条件を変更してお試しください。
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  )
}

