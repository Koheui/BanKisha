'use client'

interface ArticleDetailProps {
  articleId: string
}

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">記事詳細</h1>
      <p className="text-gray-600 mt-4">記事ID: {articleId}</p>
      <p className="text-gray-600 mt-2">記事詳細ページは現在開発中です。</p>
    </div>
  )
}

