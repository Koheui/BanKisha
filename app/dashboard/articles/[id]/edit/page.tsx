import { Suspense } from 'react'
import { ArticleEditor } from '@/components/articles/ArticleEditor'
import { Card, CardContent } from '@/components/ui/card'
import { LoaderIcon } from 'lucide-react'

interface EditArticlePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const { id } = await params
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
          <ArticleEditor articleId={id} />
        </Suspense>
      </div>
    </div>
  )
}

