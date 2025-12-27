'use client'

import type { Article } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { FileTextIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'

interface CategoryArticlesProps {
  articles: Article[]
}

export function CategoryArticles({ articles }: CategoryArticlesProps) {
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

  const featuredArticle = articles[0]
  const otherArticles = articles.slice(1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-8">
        {/* Featured Article */}
        <Link href={`/media/articles/${featuredArticle.id}`} className="group block mb-8">
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-sm">
             {featuredArticle.coverImageUrl && (
                <Image
                    src={featuredArticle.coverImageUrl}
                    alt={featuredArticle.draftArticle.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
             )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
                <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded">FEATURED</span>
                <h2 className="text-2xl md:text-3xl font-bold text-white mt-2 font-display">
                    {featuredArticle.draftArticle.title}
                </h2>
            </div>
          </div>
        </Link>

        {/* Article List */}
        <div className="space-y-6">
            {otherArticles.map(article => (
                <ArticleCard key={article.id} article={article} />
            ))}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="lg:col-span-4 space-y-8">
        <div>
          <h3 className="text-lg font-bold mb-4 border-b pb-2">Trending</h3>
          {/* Placeholder for trending articles */}
          <div className="space-y-4">
             <p className="text-sm text-muted-light">Trending articles will be shown here.</p>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold mb-4 border-b pb-2">Popular Topics</h3>
          {/* Placeholder for popular topics */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-gray-100 dark:bg-gray-800 text-sm px-3 py-1 rounded-full">Fintech</span>
            <span className="bg-gray-100 dark:bg-gray-800 text-sm px-3 py-1 rounded-full">Cybersecurity</span>
             <span className="bg-gray-100 dark:bg-gray-800 text-sm px-3 py-1 rounded-full">AI</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

