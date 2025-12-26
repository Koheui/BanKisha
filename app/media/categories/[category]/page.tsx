import { Suspense } from 'react'
import { CategoryArticles } from '@/components/media/CategoryArticles'
import { LoaderIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Metadata } from 'next'

interface CategoryPageProps {
  params: Promise<{
    category: string
  }>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const decodedCategory = decodeURIComponent(category)

  return {
    title: `${decodedCategory} | BanKisha-Kawaraban（番記者瓦版）`,
    description: `${decodedCategory}カテゴリの記事一覧ページです。`,
  }
}

export default async function MediaCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params
  const decodedCategory = decodeURIComponent(category)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {decodedCategory}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {decodedCategory}カテゴリの記事一覧です。
        </p>
      </div>

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
        <CategoryArticles category={decodedCategory} />
      </Suspense>
    </div>
  )
}

