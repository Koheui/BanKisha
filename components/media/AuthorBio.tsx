'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { User } from '@/src/types'

interface AuthorBioProps {
  author: User | null
}

export const AuthorBio = ({ author }: AuthorBioProps) => {
  if (!author) {
    return null
  }

  return (
    <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-start gap-4">
        {author.photoURL && (
          <div className="flex-shrink-0">
            <Image
              src={author.photoURL}
              alt={author.displayName || 'Author'}
              width={64}
              height={64}
              className="rounded-full"
            />
          </div>
        )}
        <div className="flex-grow">
          <p className="text-xs text-muted-light dark:text-muted-dark font-semibold uppercase tracking-wider">
            この記事を書いた人
          </p>
          <h3 className="text-lg font-bold text-text-dark dark:text-text-light mt-1">
            {author.displayName}
          </h3>
          {author.bio && (
            <p className="text-sm text-muted-light dark:text-muted-dark mt-2">
              {author.bio}
            </p>
          )}
          <Link
            href={`/media/authors/${author.id}`}
            className="text-sm font-bold text-primary hover:underline mt-3 inline-block"
          >
            この著者の他の記事を見る
          </Link>
        </div>
      </div>
    </div>
  )
}
