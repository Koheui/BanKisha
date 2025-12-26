'use client'

import { useEffect, useState } from 'react'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { LoaderIcon, FileTextIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface RelatedArticlesProps {
  currentArticle: Article
  limit?: number
}

interface ArticleWithCompany extends Article {
  company?: Company
}

export function RelatedArticles({ currentArticle, limit = 3 }: RelatedArticlesProps) {
  const [relatedArticles, setRelatedArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRelatedArticles()
  }, [currentArticle.id, currentArticle.companyId, currentArticle.category])

  const loadRelatedArticles = async () => {
    try {
      setLoading(true)

      const [publicArticles, companies] = await Promise.all([
        getArticles('public'),
        getCompanies().catch(() => [] as Company[]),
      ])

      // 同じ企業または同じカテゴリの記事を取得（現在の記事を除く）
      const related = publicArticles
        .filter(
          (article) =>
            article.id !== currentArticle.id &&
            (article.companyId === currentArticle.companyId ||
              article.category === currentArticle.category)
        )
        .slice(0, limit)
        .map((article) => {
          const company = companies.find((c) => c.id === article.companyId)
          return { ...article, company }
        })

      setRelatedArticles(related)
    } catch (error) {
      console.error('Error loading related articles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoaderIcon className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (relatedArticles.length === 0) {
    return null
  }

  return (
    <section className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        関連記事
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedArticles.map((article) => (
          <ArticleCard key={article.id} article={article} company={article.company} />
        ))}
      </div>
    </section>
  )
}


