'use client'

import type { Article } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { FileTextIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface CompanyArticlesProps {
  articles: Article[]
}

export function CompanyArticles({ articles }: CompanyArticlesProps) {
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
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}


