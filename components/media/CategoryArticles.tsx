'use client'

import { useEffect, useState } from 'react'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { LoaderIcon, FileTextIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface CategoryArticlesProps {
  category: string
}

interface ArticleWithCompany extends Article {
  company?: Company
}

export function CategoryArticles({ category }: CategoryArticlesProps) {
  const [articles, setArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategoryArticles()
  }, [category])

  const loadCategoryArticles = async () => {
    try {
      setLoading(true)

      const [categoryArticles, companies] = await Promise.all([
        getArticles('public', undefined, category),
        getCompanies().catch(() => [] as Company[]),
      ])

      const articlesWithCompany = categoryArticles.map((article) => {
        const company = companies.find((c) => c.id === article.companyId)
        return { ...article, company }
      })

      setArticles(articlesWithCompany)
    } catch (error) {
      console.error('Error loading category articles:', error)
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

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileTextIcon className="w-8 h-8 text-gray-400" />
          </div>
          <CardTitle className="text-center">まだ記事がありません</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} company={article.company} />
      ))}
    </div>
  )
}

