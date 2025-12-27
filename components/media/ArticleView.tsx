'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ShareButtons } from './ShareButtons'
import { RelatedArticles } from './RelatedArticles'
import { ArticleAuthor } from './ArticleAuthor'
import { ArticleTags } from './ArticleTags'
import { AuthorBio } from './AuthorBio'
import { ReadingProgressBar } from './ReadingProgressBar'
import { ArticleComments } from './ArticleComments'
import type { Article, ArticleSection, Company, User } from '@/src/types'

interface ArticleViewProps {
  article: Article
  company: Company | null
  author: User | null
}

export function ArticleView({ article, company, author }: ArticleViewProps) {
  const [viewCount, setViewCount] = useState<number>(article.engagement?.views || 0)

  useEffect(() => {
    incrementViewCount()
  }, [article.id])

  const incrementViewCount = async () => {
    try {
      const response = await fetch(`/api/media/articles/${article.id}/view`, {
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

  const images = article.images || []
  const coverImageUrl =
    article.coverImageUrl ||
    article.publicMeta?.coverImageUrl ||
    images.find((img) => img.position === -1)?.url

  const publishedAt =
    article.publishedAt || article.publicMeta?.publishedAt || article.createdAt

  const byline = article.publicMeta?.byline || company?.name

  return (
    <>
      <ReadingProgressBar />
      <article className="bg-white dark:bg-background-dark font-sans">
        {/* Cover Image */}
        {coverImageUrl && (
          <div className="relative w-full h-64 md:h-96">
            <Image
              src={coverImageUrl}
              alt={article.draftArticle.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Title & Meta */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold font-display text-text-dark dark:text-text-light leading-tight mb-4">
              {article.draftArticle.title}
            </h1>
            <p className="text-lg text-muted-light dark:text-muted-dark mb-6">
              {article.draftArticle.lead}
            </p>
            <div className="border-y border-gray-200 dark:border-gray-700 py-4">
              <ArticleAuthor
                author={author}
                date={publishedAt}
                readingTimeSec={article.readingTimeSec}
                byline={byline}
              />
            </div>
          </header>

          {/* Body Sections */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {article.draftArticle.sections.map((section: ArticleSection, idx: number) => {
              const sectionImages = images.filter((img) => img.position === idx)
              return (
                <section key={idx}>
                  <h2 className="font-display">{section.heading}</h2>
                  {sectionImages.map((img) => (
                    <figure key={img.id} className="my-6">
                      <div className="relative w-full aspect-video">
                        <Image
                          src={img.url}
                          alt={img.alt || section.heading}
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                      {img.alt && (
                        <figcaption className="text-center text-sm text-muted-light dark:text-muted-dark mt-2">
                          {img.alt}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                  <div className="whitespace-pre-wrap">{section.body}</div>
                </section>
              )
            })}
          </div>

          {/* Tags */}
          {article.aiMetadata?.topics && article.aiMetadata.topics.length > 0 && (
            <ArticleTags tags={article.aiMetadata.topics} />
          )}

          {/* Author Bio */}
          <AuthorBio author={author} />

          {/* Share Buttons & Related Articles */}
          <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
            <ShareButtons
              title={article.draftArticle.title}
              url={typeof window !== 'undefined' ? window.location.href : ''}
              description={
                article.summary ||
                article.publicMeta?.summary ||
                article.draftArticle.lead
              }
            />
          </div>

          <div className="mt-12">
            <RelatedArticles currentArticle={article} />
          </div>
          <ArticleComments articleId={article.id} />
        </div>
      </article>
    </>
  )
}
