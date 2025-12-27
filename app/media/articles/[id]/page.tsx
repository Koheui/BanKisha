import { Suspense } from 'react'
import { ArticleView } from '@/components/media/ArticleView'
import { Card, CardContent } from '@/components/ui/card'
import { LoaderIcon } from 'lucide-react'
import { Metadata } from 'next'
import { getArticle, getCompany, getUser } from '@/src/lib/firestore'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)

  if (!article || article.status !== 'public') {
    return {
      title: '記事が見つかりません | BanKisha-Kawaraban（番記者瓦版）',
    }
  }

  const coverImageUrl = article.coverImageUrl ||
    article.publicMeta?.coverImageUrl ||
    (article.images?.find(img => img.position === -1)?.url)

  const description = article.summary ||
    article.publicMeta?.summary ||
    article.draftArticle.lead.substring(0, 150)

  const companyName = article.companyId ? (await getCompany(article.companyId))?.name : 'BanKisha'

  return {
    title: `${article.draftArticle.title} | ${companyName}`,
    description,
    openGraph: {
      title: article.draftArticle.title,
      description,
      type: 'article',
      siteName: companyName,
      ...(coverImageUrl && { images: [coverImageUrl] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.draftArticle.title,
      description,
      ...(coverImageUrl && { images: [coverImageUrl] }),
    },
  }
}

export default async function MediaArticlePage({ params }: ArticlePageProps) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article || article.status !== 'public') {
    notFound()
  }

  const company = article.companyId ? await getCompany(article.companyId) : null
  const author = article.ownerUserId ? await getUser(article.ownerUserId) : null

  const coverImageUrl = article.coverImageUrl ||
    article.publicMeta?.coverImageUrl ||
    (article.images?.find(img => img.position === -1)?.url)

  const publishedAt = article.publishedAt ||
    article.publicMeta?.publishedAt ||
    article.createdAt

  // 構造化データ（JSON-LD）
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.draftArticle.title,
    description: article.summary || article.publicMeta?.summary || article.draftArticle.lead,
    image: coverImageUrl ? [coverImageUrl] : [],
    datePublished: publishedAt?.toISOString(),
    dateModified: article.updatedAt?.toISOString(),
    author: {
      '@type': 'Organization',
      name: company?.name || 'BanKisha',
    },
    publisher: {
      '@type': 'Organization',
      name: company?.name || 'BanKisha',
    },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Suspense
        fallback={
          <Card>
            <CardContent className="p-8 text-center">
              <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
            </CardContent>
          </Card>
        }
      >
        <ArticleView article={article} company={company} author={author} />
      </Suspense>
    </div>
  )
}

