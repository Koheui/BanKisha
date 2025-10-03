'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import { generateSnippet, formatDate } from '@/src/lib/utils'
import type { Article, Company } from '@/src/types'
import { CalendarIcon, BuildingIcon, EyeIcon } from 'lucide-react'

interface ArticleWithCompany extends Article {
  company?: Company
}

export function ArticlesList() {
  const [articles, setArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const publicArticles = await getArticles('public')
      const companies = await getCompanies()
      
      // Combine articles with company data
      const articlesWithCompany = publicArticles.map(article => {
        const company = companies.find(c => c.id === article.companyId)
        return { ...article, company }
      })
      
      setArticles(articlesWithCompany)
      setError(null)
    } catch (err) {
      console.error('Error loading articles:', err)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <CardTitle className="text-center">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
              </CardTitle>
              <CardDescription className="text-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="w-16 h-16 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-center text-red-600 dark:text-red-400">エラーが発生しました</CardTitle>
          <CardDescription className="text-center">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileTextIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <CardTitle className="text-lg">まだ記事がありません</CardTitle>
            <CardDescription>
              企業様からのご協力をお待ちしております。<br />
              記事が公開されるとこちらに表示されます。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg: grid-cols-3 gap-6">
      {articles.map((article) => (
        <Card key={article.id} className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
          <CardHeader className="text-center pb-4">
            {/* Company Logo */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              {article.company?.logoUrl ? (
                <img 
                  src={article.company.logoUrl} 
                  alt={article.company.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <BuildingIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            
            <CardTitle className="text-lg font-bold leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {article.finalArticle?.title || article.draftArticle.title}
            </CardTitle>
            
            <CardDescription className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-xs">
                {article.company?.name || '企業情報なし'}
              </Badge>
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {generateSnippet(article.finalArticle?.lead || article.draftArticle.lead)}
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {article.publicMeta?.publishedAt ? formatDate(article.publicMeta.publishedAt) : '公開予定'}
              </div>
              {article.publicMeta?.byline && (
                <Badge variant="secondary" className="text-xs">
                  {article.publicMeta.byline}
                </Badge>
              )}
            </div>
            
            <Link href={`/articles/${article.id}`}>
              <Button variant="gradient" className="w-full group">
                記事を読む
                <EyeIcon className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
