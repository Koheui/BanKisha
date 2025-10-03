import { Suspense } from 'react'
import { ArticlesList } from '@/components/articles/ArticlesList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircleIcon, FileTextIcon } from 'lucide-react'

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
                  <CardTitle className="text-center">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
                  </CardTitle>
                  <CardDescription className="text-center">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
                  </CardDescription>
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

        {/* Empty State */}
        <div className="text-center mt-12">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileTextIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">記事の投稿をお待ちしています</CardTitle>
              <CardDescription>
                企業様からのご協力をお待ちしております。記事が公開されるとこちらに表示されます。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
