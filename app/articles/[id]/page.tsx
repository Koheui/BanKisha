import { Suspense } from 'react'
import { ArticleDetail } from '@/components/articles/ArticleDetail'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircleIcon, LoaderIcon } from 'lucide-react'

interface ArticlePageProps {
  params: {
    id: string
  }
}

export default function ArticlePage({ params }: ArticlePageProps) {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <LoaderIcon className="w-8 h-8 animate-spin text-blue-600" />
              </div>
                <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
            </CardContent>
          </Card>
        }>
          <ArticleDetail articleId={params.id} />
        </Suspense>
        
        {/* Back to Articles */}
        <div className="mt-8 text-center">
          <a 
            href="/articles" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← 記事一覧に戻る
          </a>
        </div>
      </div>
    </div>
  )
}
