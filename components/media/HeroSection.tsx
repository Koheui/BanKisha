'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getArticles } from '@/src/lib/firestore'
import type { Article } from '@/src/types'
import { formatDate } from '@/src/lib/utils'
import { CalendarIcon, ArrowRightIcon } from 'lucide-react'

export function HeroSection() {
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeaturedArticles()
  }, [])

  const loadFeaturedArticles = async () => {
    try {
      const articles = await getArticles('public')
      // featured=true の記事を優先、なければ最新3件
      const featured = articles.filter(a => a.featured).slice(0, 3)
      const latest = featured.length < 3 
        ? [...featured, ...articles.filter(a => !a.featured).slice(0, 3 - featured.length)]
        : featured
      setFeaturedArticles(latest)
    } catch (error) {
      console.error('Error loading featured articles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || featuredArticles.length === 0) {
    return null
  }

  const mainArticle = featuredArticles[0]

  return (
    <section className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Featured Article */}
          {mainArticle && (
            <Link href={`/media/articles/${mainArticle.id}`} className="group">
              <div className="relative h-96 rounded-lg overflow-hidden shadow-2xl">
                {mainArticle.coverImageUrl || mainArticle.publicMeta?.coverImageUrl ? (
                  <Image
                    src={mainArticle.coverImageUrl || mainArticle.publicMeta?.coverImageUrl || ''}
                    alt={mainArticle.draftArticle.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="flex items-center gap-2 text-sm mb-2 opacity-90">
                    <CalendarIcon className="w-4 h-4" />
                    <span>
                      {formatDate(mainArticle.publishedAt || mainArticle.publicMeta?.publishedAt || mainArticle.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2 line-clamp-2">
                    {mainArticle.draftArticle.title}
                  </h2>
                  <p className="text-lg line-clamp-2 opacity-90">
                    {mainArticle.summary || mainArticle.publicMeta?.summary || mainArticle.draftArticle.lead}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm font-semibold">
                    続きを読む
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Secondary Featured Articles */}
          <div className="space-y-4">
            {featuredArticles.slice(1, 3).map((article) => (
              <Link
                key={article.id}
                href={`/media/articles/${article.id}`}
                className="group block"
              >
                <div className="flex gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-colors">
                  {article.coverImageUrl || article.publicMeta?.coverImageUrl ? (
                    <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={article.coverImageUrl || article.publicMeta?.coverImageUrl || ''}
                        alt={article.draftArticle.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 flex-shrink-0 rounded-lg bg-white/20" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-2 line-clamp-2 group-hover:underline">
                      {article.draftArticle.title}
                    </h3>
                    <p className="text-sm opacity-90 line-clamp-2">
                      {article.summary || article.publicMeta?.summary || article.draftArticle.lead}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}


