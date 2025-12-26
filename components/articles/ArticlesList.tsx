'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import { generateSnippet, formatDate } from '@/src/lib/utils'
import type { Article, Company } from '@/src/types'
import { CalendarIcon, BuildingIcon, EyeIcon, FileTextIcon, AlertCircleIcon } from 'lucide-react'

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
      setError(null)

      // Check if Firebase is configured
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        setError('Firebase設定が完了していません。.env.localファイルを確認してください。')
        setLoading(false)
        return
      }

      try {
        // Fetch articles and companies in parallel for better performance
        const [publicArticles, companies] = await Promise.all([
          getArticles('public'),
          getCompanies().catch(err => {
            console.warn('Error loading companies, continuing without company data:', err)
            return [] as Company[]
          })
        ])

        // Combine articles with company data
        const articlesWithCompany = publicArticles.map(article => {
          const company = companies.find(c => c.id === article.companyId)
          return { ...article, company }
        })

        setArticles(articlesWithCompany)
        setError(null)
      } catch (err: any) {
        console.error('Error in fetching process:', err)
        throw err // Re-throw to be caught by the outer catch block
      }
    } catch (err: any) {
      console.error('Error loading articles:', err)
      const errorMessage = err?.message || '記事の読み込みに失敗しました'
      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        setError('データのアクセス権限がありません。Firebaseの設定（Security Rules等）を確認してください。')
      } else if (errorMessage.includes('network') || errorMessage.includes('NETWORK')) {
        setError('ネットワークエラーが発生しました。接続を確認してください。')
      } else {
        setError(`記事の読み込みに失敗しました: ${errorMessage}`)
      }
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
              <div className="text-center">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
              </div>
              <div className="text-sm text-muted-foreground text-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
              </div>
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
      <Card className="max-w-2xl mx-auto border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
        <CardHeader>
          <div className="w-16 h-16 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircleIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-center text-yellow-800 dark:text-yellow-300">設定が必要です</CardTitle>
          <CardDescription className="text-center text-yellow-700 dark:text-yellow-400 mt-4">
            {error}
          </CardDescription>
          <CardContent className="mt-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold mb-2">セットアップ手順:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>env.exampleを.env.localにコピー</li>
                <li>Firebase Consoleから設定値を取得</li>
                <li>.env.localに設定値を入力</li>
                <li>開発サーバーを再起動</li>
              </ol>
            </div>
          </CardContent>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {article.company?.name || '企業情報なし'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {generateSnippet(article.finalArticle?.lead || article.draftArticle.lead)}
            </div>

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
