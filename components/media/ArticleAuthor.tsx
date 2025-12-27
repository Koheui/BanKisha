'use client'

import Image from 'next/image'
import type { User } from '@/src/types'
import { formatDate } from '@/src/lib/utils'
import { Bookmark, Share2 } from 'lucide-react'

interface ArticleAuthorProps {
  author: User | null
  date: Date | null
  readingTimeSec?: number
  byline?: string
}

export const ArticleAuthor = ({ author, date, readingTimeSec, byline }: ArticleAuthorProps) => {
  const displayName = author?.displayName || byline || 'BanKisha Contributor'
  const photoURL = author?.photoURL

  const readingTimeMin = readingTimeSec ? Math.ceil(readingTimeSec / 60) : null

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        {photoURL ? (
          <Image
            src={photoURL}
            alt={displayName}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        )}
        <div>
          <p className="font-bold text-sm text-text-dark dark:text-text-light">{displayName}</p>
          {date && (
            <p className="text-xs text-muted-light dark:text-muted-dark">
              {formatDate(date)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-muted-light dark:text-muted-dark">
        {readingTimeMin && (
          <span className="text-xs font-mono">{readingTimeMin} MIN READ</span>
        )}
        <button className="hover:text-primary transition-colors">
          <Bookmark size={20} />
        </button>
        <button className="hover:text-primary transition-colors">
          <Share2 size={20} />
        </button>
      </div>
    </div>
  )
}
