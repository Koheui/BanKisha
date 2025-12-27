import Link from 'next/link'
import Image from 'next/image'
import type { Article } from '@/src/types'

interface HeroSectionProps {
  article: Article
}

export const HeroSection = ({ article }: HeroSectionProps) => {
  if (!article) {
    return null
  }

  const coverImageUrl = article.coverImageUrl || article.publicMeta?.coverImageUrl

  return (
    <article className="group cursor-pointer">
      <Link href={`/media/articles/${article.id}`}>
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl mb-4 shadow-sm">
          {coverImageUrl ? (
             <Image
                src={coverImageUrl}
                alt={article.draftArticle.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority
              />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10"></div>
          <div className="absolute bottom-0 left-0 p-6 z-20">
            {article.category && (
               <span className="inline-block px-2 py-1 mb-3 text-xs font-bold text-white bg-primary rounded uppercase tracking-wider">
                {article.category}
              </span>
            )}
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-2 drop-shadow-md font-display">
              {article.draftArticle.title}
            </h2>
            <p className="text-gray-200 text-lg hidden md:block max-w-2xl font-sans font-light">
              {article.summary || article.draftArticle.lead}
            </p>
          </div>
        </div>
      </Link>
    </article>
  )
}


