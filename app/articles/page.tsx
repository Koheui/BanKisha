import { Suspense } from 'react'
import { ArticlesList } from '@/components/articles/ArticlesList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ArticlesPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            企業インタビュー記事
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            BanKishaが取材した企業のインタビュー記事をご覧いただけます。
            各企業の経営理念、事業内容、今後の展望などを詳しくお聞きしました。
          </p>
        </div>

        {/* Loading Fallback */}
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                  <div className="text-center">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
                  </div>
                  <div className="text-sm text-muted-foreground text-center">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }>
          <ArticlesList />
        </Suspense>

      </div>
    </div>
  )
}
