import { Suspense } from 'react'
import { ArticlesList } from '@/components/media/ArticlesList'
import { LoaderIcon } from 'lucide-react'

export const metadata = {
  title: '記事一覧 | BanKisha-Kawaraban（番記者瓦版）',
  description: 'BanKisha-Kawaraban（番記者瓦版）の記事一覧ページです。',
}

export default function MediaArticlesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          記事一覧
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          公開されている記事を一覧でご覧いただけます。
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
              />
            ))}
          </div>
        }
      >
        <ArticlesList />
      </Suspense>
    </div>
  )
}

