import Link from 'next/link'
import { Tag } from 'lucide-react'

interface ArticleTagsProps {
  tags: string[]
}

export const ArticleTags = ({ tags }: ArticleTagsProps) => {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
       <Tag className="w-4 h-4 text-muted-light dark:text-muted-dark" />
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/media/search?tag=${encodeURIComponent(tag)}`}
          className="inline-block bg-gray-100 dark:bg-gray-800 text-muted-light dark:text-muted-dark hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-white text-xs font-medium px-3 py-1 rounded-full transition-colors"
        >
          # {tag}
        </Link>
      ))}
    </div>
  )
}
