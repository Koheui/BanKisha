'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getArticle, getCompany } from '@/src/lib/firestore'
import { formatDate } from '@/src/lib/utils'
import type { Article, Company } from '@/src/types'
import { 
  CalendarIcon, 
  BuildingIcon, 
  GlobeIcon, 
  CalendarDaysIcon,
  UserIcon,
  AlertCircleIcon
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ArticleDetailProps {
  articleId: string
}

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  const [article, setArticle] = useState<Article | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadArticle()
  }, [articleId])

  const loadArticle = async () => {
    try {
      setLoading(true)
      const articleData = await getArticle(articleId)
      
      if (!articleData) {
        setError('記事が見つかりません')
        return
      }
      
      if (articleData.status !== 'public') {
        setError('この記事はまだ公開されていません')
        return
      }
      
      setArticle(articleData)
      
      // Load company data
      const companyData = await getCompany(articleData.companyId)
      setCompany(companyData)
      
      setError(null)
    } catch (err) {
      console.error('Error loading article:', err)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
          </div>
        </CardContent>
      </ </>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">エラー</h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (!article) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">記事が見つかりません</p>
        </CardContent>
      </Card>
    )
  }

  const articleContent = article.finalArticle || article.draftArticle

  return (
    <div className="space-y-8">
      {/* Article Header */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 opacity-50" />
        <CardHeader className="relative">
          <div className="flex items-center gap-4 mb-6">
            {/* Company Logo */}
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md">
              {company?.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt={company.name}
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <BuildingIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {company?.name}
                </Badge>
                {article.publicMeta?.mediaBadge && (
                  <Badge variant="secondary" className="text-xs">
                    {article.publicMeta.mediaBadge}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold gradient-text leading-tight">
                {articleContent.title}
              </h1>
            </div>
          </div>
          
          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            {article.publicMeta?.publishedAt && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                公開日: {formatDate(article.publicMeta.publishedAt)}
              </div>
            )}
            
            {article.publicMeta?.byline && (
              <div className="flex items-center gap-1">
                <UserIcon className="w-4 h-4" />
                取材: {article.publicMeta.byline}
              </div>
            )}
            
            {company?.website && (
              <a 
                href={company.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <GlobeIcon className="w-4 h-4" />
                企業サイト
              </a>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Article Lead */}
      <Card>
        <CardContent className="p-8">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-xl leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
              {articleContent.lead}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Article Content */}
      <Card>
        <CardContent className="p-8">
          <div className="prose prose-custom max-w-none">
            <ReactMarkdown>{articleContent.bodyMd}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Related Company Info */}
      {company && (
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-bold">関連企業情報</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">企業名</h3>
                <p className="text-gray-600 dark:text-gray-400">{company.name}</p>
              </div>
              
              {company.foundedYear && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">設立年</h3>
                  <p className="text-gray-600 dark:text-gray-400">{company.foundedYear}年</p>
                </div>
              )}
              
              {company.description && (
                <div className="md:col-span-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">企業概要</h3>
                  <p className="text-gray-600 dark:text-gray-400">{company.description}</p>
                </div>
              )}
              
              {company.website && (
                <div className="md:col-span-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">ウェブサイト</h3>
                  <a 
                    href={company.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {company.website}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="px-4 py-2">
              BanKisha発行
            </Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              この記事はBanKishaが取材を行い、編集・公開いたしました。
            </p>
            {/* TODO: Add social sharing buttons */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" size="sm">
                Twitterでシェア
              </Button>
              <Button variant="outline" size="sm">
                LinkedInでシェア
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
