'use client'

import { useEffect, useState } from 'react'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'

interface ArticleWithCompany extends Article {
  company?: Company
}

interface CategorySectionProps {
  category: string
  limit?: number
}

export function CategorySection({ category, limit = 3 }: CategorySectionProps) {
  const [articles, setArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategoryArticles()
  }, [category])

  const loadCategoryArticles = async () => {
    try {
      const [publicArticles, companies] = await Promise.all([
        getArticles('public'),
        getCompanies().catch(() => [] as Company[]),
      ])

      const categoryArticles = publicArticles
        .filter((article) => article.category === category)
        .slice(0, limit)
        .map((article) => {
          const company = companies.find((c) => c.id === article.companyId)
          return { ...article, company }
        })

      setArticles(categoryArticles)
    } catch (error) {
      console.error('Error loading category articles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {category}
        </h2>
        <Link
          href={`/media/categories/${encodeURIComponent(category)}`}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          すべて見る
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} company={article.company} />
        ))}
      </div>
    </section>
  )
}


