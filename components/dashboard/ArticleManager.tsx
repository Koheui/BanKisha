'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getArticles } from '@/src/lib/firestore'
import { formatDate } from '@/src/lib/utils'
import type { Article } from '@/src/types'
import {
  FileTextIcon,
  EditIcon,
  SendIcon,
  EyeIcon,
  TrashIcon,
  AlertCircleIcon,
  LoaderIcon
} from 'lucide-react'

interface ArticleManagerProps {
  companyId: string | null
  onStatsUpdate?: (stats: { drafts: number; submitted: number; approved: number; public: number }) => void
}

export function ArticleManager({ companyId, onStatsUpdate }: ArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'public'>('all')

  useEffect(() => {
    if (companyId) {
      loadArticles()
    }
  }, [companyId, filter])

  const loadArticles = async () => {
    if (!companyId) return

    try {
      setLoading(true)
      const filterStatus = filter === 'all' ? undefined : filter
      const data = await getArticles(filterStatus)
      setArticles(data)

      // Update stats
      if (onStatsUpdate) {
        const stats = {
          drafts: data.filter(a => a.status === 'draft').length,
          submitted: data.filter(a => a.status === 'submitted').length,
          approved: data.filter(a => a.status === 'approved').length,
          public: data.filter(a => a.status === 'public').length
        }
        onStatsUpdate(stats)
      }
    } catch (err) {
      console.error('Error loading articles:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'draft',
      submitted: 'submitted',
      approved: 'approved',
      public: 'public'
    }
    return <Badge variant={variants[status] || 'default'}>{getStatusLabel(status)}</Badge>
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '下書き',
      submitted: '申請中',
      approved: '承認済み',
      public: '公開中'
    }
    return labels[status] || status
  }

  if (!companyId) {
    return (
      <Card>
        <CardHeader>
          <div className="text-center">
            <AlertCircleIcon className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <CardTitle>企業情報が設定されていません</CardTitle>
            <CardDescription>
              管理者にお問い合わせください
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="w-6 h-6" />
            記事管理
          </CardTitle>
          <CardDescription>
            あなたの企業の記事を管理できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'gradient' : 'outline'}
              onClick={() => setFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={filter === 'draft' ? 'gradient' : 'outline'}
              onClick={() => setFilter('draft')}
            >
              下書き
            </Button>
            <Button
              variant={filter === 'submitted' ? 'gradient' : 'outline'}
              onClick={() => setFilter('submitted')}
            >
              申請中
            </Button>
            <Button
              variant={filter === 'approved' ? 'gradient' : 'outline'}
              onClick={() => setFilter('approved')}
            >
              承認済み
            </Button>
            <Button
              variant={filter === 'public' ? 'gradient' : 'outline'}
              onClick={() => setFilter('public')}
            >
              公開中
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Articles List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
          </CardContent>
        </Card>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'all' ? '記事がまだありません' : `${getStatusLabel(filter)}の記事がありません`}
            </p>
            <Button variant="gradient" className="mt-4">
              新規インタビューを開始
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {articles.map((article) => (
            <Card key={article.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(article.status)}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(article.createdAt)}
                      </span>
                    </div>
                    <CardTitle className="text-xl mb-2">
                      {article.finalArticle?.title || article.draftArticle.title || '無題の記事'}
                    </CardTitle>
                    <CardDescription>
                      {article.finalArticle?.lead || article.draftArticle.lead || '記事の概要がありません'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {article.status === 'draft' && (
                    <>
                      <Link href={`/dashboard/articles/${article.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <EditIcon className="w-4 h-4 mr-2" />
                          編集
                        </Button>
                      </Link>
                      <Button variant="gradient" size="sm">
                        <SendIcon className="w-4 h-4 mr-2" />
                        承認申請
                      </Button>
                    </>
                  )}

                  {article.status === 'submitted' && (
                    <Button variant="outline" size="sm" disabled>
                      <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                      承認待ち
                    </Button>
                  )}

                  {(article.status === 'approved' || article.status === 'public') && (
                    <Link href={`/articles/${article.id}`}>
                      <Button variant="gradient" size="sm">
                        <EyeIcon className="w-4 h-4 mr-2" />
                        記事を見る
                      </Button>
                    </Link>
                  )}

                  {article.status === 'draft' && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <TrashIcon className="w-4 h-4 mr-2" />
                      削除
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
