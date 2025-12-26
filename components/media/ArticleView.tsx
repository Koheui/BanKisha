'use client'

import { useState, useEffect } from 'react'
import { getArticle } from '@/src/lib/firestore'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoaderIcon, AlertCircleIcon, CalendarIcon, BuildingIcon, EyeIcon } from 'lucide-react'
import { ShareButtons } from './ShareButtons'
import { RelatedArticles } from './RelatedArticles'
import type { Article, ArticleSection } from '@/src/types'
import { formatDate } from '@/src/lib/utils'
import { getCompany } from '@/src/lib/firestore'
import type { Company } from '@/src/types'

interface ArticleViewProps {
  articleId: string
}

export function ArticleView({ articleId }: ArticleViewProps) {
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<Article | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewCount, setViewCount] = useState<number | null>(null)

  useEffect(() => {
    if (articleId) {
      loadArticle()
      incrementViewCount()
    }
  }, [articleId])

  const incrementViewCount = async () => {
    try {
      const response = await fetch(`/api/media/articles/${articleId}/view`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setViewCount(data.views)
      }
    } catch (error) {
      console.error('Error incrementing view count:', error)
    }
  }

  const loadArticle = async () => {
    try {
      setLoading(true)
      setError(null)

      const articleData = await getArticle(articleId)

      if (!articleData) {
        setError('記事が見つかりません')
        return
      }

      // status='public' の記事のみ表示
      if (articleData.status !== 'public') {
        setError('この記事は公開されていません')
        return
      }

      setArticle(articleData)
      setViewCount(articleData.engagement?.views || 0)

      // 企業情報を取得
      if (articleData.companyId) {
        try {
          const companyData = await getCompany(articleData.companyId)
          setCompany(companyData)
        } catch (err) {
          console.warn('Error loading company:', err)
        }
      }
    } catch (err: any) {
      console.error('Error loading article:', err)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
      </div>
    )
  }

  if (error || !article) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardContent className="p-8 text-center">
          <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-800 dark:text-red-300 font-semibold">
            {error || '記事が見つかりません'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const images = article.images || []
  const coverImage = images.find((img) => img.position === -1)
  const coverImageUrl = article.coverImageUrl ||
    article.publicMeta?.coverImageUrl ||
    coverImage?.url

  const publishedAt = article.publishedAt ||
    article.publicMeta?.publishedAt ||
    article.createdAt

  return (
    <article className="bg-white dark:bg-gray-900">
      {/* Cover Image */}
      {coverImageUrl && (
        <div className="relative w-full h-96 mb-8">
          <Image
            src={coverImageUrl}
            alt={article.draftArticle.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
          {publishedAt && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              <span>{formatDate(publishedAt)}</span>
            </div>
          )}
          {company && (
            <div className="flex items-center gap-1">
              <BuildingIcon className="w-4 h-4" />
              <span>{company.name}</span>
            </div>
          )}
          {viewCount !== null && (
            <div className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              <span>{viewCount.toLocaleString()} 回閲覧</span>
            </div>
          )}
          {article.category && (
            <Badge variant="outline" className="text-xs">
              {article.category}
            </Badge>
          )}
        </div>

        {/* Title & Lead */}
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight mb-6">
            {article.draftArticle.title}
          </h1>
          {article.draftArticle.lead && (
            <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              {article.draftArticle.lead}
            </p>
          )}
        </header>

        {/* Body Sections */}
        <div className="space-y-12 prose prose-lg dark:prose-invert max-w-none">
          {article.draftArticle.sections.map((section: ArticleSection, idx: number) => {
            const sectionImages = images.filter((img) => img.position === idx)
            return (
              <section key={idx} className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 border-l-4 border-blue-600 pl-4 py-1">
                  {section.heading}
                </h2>

                {sectionImages.map((img) => (
                  <figure key={img.id} className="my-8">
                    <div className="relative w-full h-96">
                      <Image
                        src={img.url}
                        alt={img.alt || section.heading}
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                    {img.alt && (
                      <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {img.alt}
                      </figcaption>
                    )}
                  </figure>
                ))}

                <div className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </div>
              </section>
            )
          })}
        </div>

        {/* Share Buttons */}
        <ShareButtons
          title={article.draftArticle.title}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          description={article.summary || article.publicMeta?.summary || article.draftArticle.lead}
        />

        {/* Related Articles */}
        <RelatedArticles currentArticle={article} />
      </div>
    </article>
  )
}

