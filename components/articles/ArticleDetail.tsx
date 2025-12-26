'use client'

import { useState, useEffect } from 'react'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { getCompany } from '@/src/lib/firestore'
import { Card, CardContent } from '@/components/ui/card'
import { LoaderIcon, AlertCircleIcon, CalendarIcon, UserIcon } from 'lucide-react'
import type { Article, ArticleSection } from '@/src/types'

interface ArticleDetailProps {
  articleId: string
}

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<Article | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  const loadArticle = async () => {
    try {
      setLoading(true)
      setError(null)

      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'articles', articleId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        setArticle({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          publishedAt: data.publishedAt?.toDate(),
        } as Article)

        // 会社名を読み込む
        if (data.companyId) {
          const company = await getCompany(data.companyId)
          if (company) {
            setCompanyName(company.name)
          }
        }
      } else {
        setError('記事が見つかりません')
      }
    } catch (error) {
      console.error('Error loading article:', error)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
      </div>
    )
  }

  if (error || !article) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-8 text-center">
          <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-800 font-semibold">{error || '記事が見つかりません'}</p>
        </CardContent>
      </Card>
    )
  }

  const images = article.images || []
  const coverImage = images.find(img => img.position === -1)

  return (
    <article className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      {/* Cover Image */}
      {coverImage && (
        <div className="w-full h-96 relative">
          <img
            src={coverImage.url}
            alt={coverImage.alt || article.draftArticle.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
          {article.publishedAt && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              <span>{article.publishedAt.toLocaleDateString('ja-JP')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <UserIcon className="w-4 h-4" />
            <span>{companyName || 'BanKisha編集部'}</span>
          </div>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            {article.category || 'インタビュー'}
          </span>
        </div>

        {/* Title & Lead */}
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight mb-6">
            {article.draftArticle.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            {article.draftArticle.lead}
          </p>
        </header>

        {/* Body Sections */}
        <div className="space-y-12">
          {article.draftArticle.sections.map((section: ArticleSection, idx: number) => {
            const sectionImages = images.filter(img => img.position === idx)
            return (
              <section key={idx} className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 border-l-4 border-blue-600 pl-4 py-1">
                  {section.heading}
                </h2>

                {sectionImages.map(img => (
                  <figure key={img.id} className="my-8">
                    <img
                      src={img.url}
                      alt={img.alt || section.heading}
                      className="w-full rounded-lg shadow-sm"
                    />
                    {img.alt && (
                      <figcaption className="text-center text-sm text-gray-500 mt-2">
                        {img.alt}
                      </figcaption>
                    )}
                  </figure>
                ))}

                <div className="text-lg text-gray-700 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </article>
  )
}
