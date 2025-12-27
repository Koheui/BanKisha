import Link from 'next/link'
import type { Article } from '@/src/types'
import { formatDate } from '@/src/lib/utils'
import { Zap } from 'lucide-react'

interface LatestNewsProps {
  articles: Article[]
}

export const LatestNews = ({ articles }: LatestNewsProps) => {
  if (!articles || articles.length === 0) {
    return null
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="text-primary" />
        <h3 className="text-lg font-bold uppercase tracking-wider">最新ニュース</h3>
      </div>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/media/articles/${article.id}`}
            className="py-3 group"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-mono text-muted-light dark:text-muted-dark">
                {formatDate(article.publishedAt, 'MM-dd')}
              </span>
              {article.category && (
                <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {article.category}
                </span>
              )}
            </div>
            <p className="text-base font-medium leading-snug group-hover:text-primary transition-colors">
              {article.draftArticle.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
