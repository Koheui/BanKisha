import Link from 'next/link'
import Image from 'next/image'
import type { Article, User } from '@/src/types' // Assuming User might be needed for author photo
import { ArrowRight } from 'lucide-react'

interface OpinionSectionProps {
  articles: Article[]
  // In a real app, you'd likely pass authors as a separate prop
  // or have them attached to the article object.
}

export const OpinionSection = ({ articles }: OpinionSectionProps) => {
  if (!articles || articles.length === 0) {
    return null
  }

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-800">
      <div className="flex justify-between items-end mb-8">
        <h2 className="text-2xl font-bold font-display">オピニオン & 分析</h2>
        <Link
          href="/media/categories/opinion"
          className="text-primary text-sm font-bold hover:underline flex items-center gap-1"
        >
          すべて見る <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/media/articles/${article.id}`}
            className="flex flex-col h-full bg-white dark:bg-[#151b2d] border border-gray-100 dark:border-gray-800 p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-4">
              {/* Placeholder for author image */}
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div>
                <p className="text-xs font-bold text-primary uppercase">{article.category}</p>
                <p className="text-sm font-medium text-text-dark dark:text-text-light">
                  {article.publicMeta?.byline || '寄稿者'}
                </p>
              </div>
            </div>
            <h3 className="text-lg font-bold font-display leading-tight mb-3 flex-grow group-hover:text-primary transition-colors">
              {article.draftArticle.title}
            </h3>
            <p className="text-sm text-muted-light dark:text-muted-dark font-sans line-clamp-3">
              {article.summary || article.draftArticle.lead}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
