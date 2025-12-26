import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, BuildingIcon } from 'lucide-react'
import type { Article, Company } from '@/src/types'
import { formatDate } from '@/src/lib/utils'

interface ArticleCardProps {
  article: Article
  company?: Company
}

export function ArticleCard({ article, company }: ArticleCardProps) {
  const coverImageUrl = article.coverImageUrl || 
    article.publicMeta?.coverImageUrl ||
    (article.images?.find(img => img.position === -1)?.url)
  
  const summary = article.summary || 
    article.publicMeta?.summary ||
    article.draftArticle.lead.substring(0, 100) + '...'

  const publishedAt = article.publishedAt || 
    article.publicMeta?.publishedAt ||
    article.createdAt

  return (
    <Link href={`/media/articles/${article.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md h-full flex flex-col">
        {/* Cover Image */}
        {coverImageUrl && (
          <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
            <Image
              src={coverImageUrl}
              alt={article.draftArticle.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <CardHeader className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {company?.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={24}
                height={24}
                className="rounded-full"
              />
            ) : (
              <BuildingIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {company?.name || '企業情報なし'}
            </span>
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {article.draftArticle.title}
          </h3>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
            {summary}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              <span>{formatDate(publishedAt)}</span>
            </div>
            {article.category && (
              <Badge variant="outline" className="text-xs">
                {article.category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}


