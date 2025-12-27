import Link from 'next/link'
import Image from 'next/image'
import type { Article } from '@/src/types'

interface SubHeroGridProps {
  articles: Article[]
}

export const SubHeroGrid = ({ articles }: SubHeroGridProps) => {
  if (!articles || articles.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 dark:border-gray-800">
      {articles.map((article) => (
        <article key={article.id} className="flex flex-col gap-3 group cursor-pointer">
          <Link href={`/media/articles/${article.id}`}>
            <div className="overflow-hidden rounded-lg aspect-video mb-1">
              {article.coverImageUrl || article.publicMeta?.coverImageUrl ? (
                <Image
                  src={article.coverImageUrl || article.publicMeta?.coverImageUrl || ''}
                  alt={article.draftArticle.title}
                  width={550}
                  height={310}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 aspect-video rounded-lg" />
              )}
            </div>
            <div className="flex flex-col">
              {article.category && (
                <span className="text-xs font-bold text-primary uppercase mb-1">{article.category}</span>
              )}
              <h3 className="text-xl font-bold leading-snug group-hover:text-primary transition-colors font-display">
                {article.draftArticle.title}
              </h3>
              <p className="text-muted-light dark:text-muted-dark text-sm mt-2 line-clamp-2 font-sans">
                {article.summary || article.draftArticle.lead}
              </p>
            </div>
          </Link>
        </article>
      ))}
    </div>
  )
}
