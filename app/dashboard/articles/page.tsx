'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { getArticles, deleteArticle } from '@/src/lib/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeftIcon,
  LoaderIcon,
  FileTextIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  FilterIcon,
  CalendarIcon,
  UserIcon,
  LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import { Article, ArticleStatus } from '@/src/types'

export default function ArticlesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadArticles()
    }
  }, [user])

  useEffect(() => {
    // ステータスフィルタを適用
    if (statusFilter === 'all') {
      setFilteredArticles(articles)
    } else {
      setFilteredArticles(articles.filter(article => article.status === statusFilter))
    }
  }, [articles, statusFilter])

  const loadArticles = async () => {
    try {
      setLoading(true)
      // user.companyIdを渡して、特定の会社の記事のみを取得
      const articlesList = await getArticles({ companyId: user?.companyId })
      setArticles(articlesList)
    } catch (error) {
      console.error('Error loading articles:', error)
      alert('❌ 記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (articleId: string) => {
    if (!confirm('この記事を削除しますか？この操作は元に戻せません。')) {
      return
    }

    try {
      setDeletingId(articleId)
      await deleteArticle(articleId)
      setArticles(articles.filter(a => a.id !== articleId))
      alert('✅ 記事を削除しました')
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('❌ 記事の削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }
  const getStatusBadge = (status: ArticleStatus) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: '下書き', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
      review: { label: '審査中', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      published: { label: '公開中', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      submitted: { label: '提出済み', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      approved: { label: '承認済み', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      public: { label: '公開', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' }
    }

    const config = statusConfig[status] || statusConfig.draft
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    )
  }


  const formatDate = (date: Date | undefined) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>ダッシュボード</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  記事管理
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  インタビューから作成された記事を管理できます
                </p>
              </div>
            </div>
            <Link href="/dashboard/articles/new">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <PlusIcon className="w-4 h-4 mr-2" />
                新しい記事を作成
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ステータス:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${statusFilter === 'all'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                すべて
              </button>
              <button
                onClick={() => setStatusFilter('draft')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${statusFilter === 'draft'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                下書き
              </button>
              <button
                onClick={() => setStatusFilter('submitted')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${statusFilter === 'submitted'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                提出済み
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${statusFilter === 'approved'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                承認済み
              </button>
              <button
                onClick={() => setStatusFilter('public')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${statusFilter === 'public'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                公開
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredArticles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileTextIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                記事がありません
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center max-w-md">
                {statusFilter === 'all'
                  ? 'インタビューから記事を作成すると、ここに表示されます。'
                  : `${statusFilter === 'draft' ? '下書き' : statusFilter === 'submitted' ? '提出済み' : statusFilter === 'approved' ? '承認済み' : '公開'}の記事がありません。`}
              </p>
              <Link href="/dashboard/articles/new">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  新しい記事を作成
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredArticles.map((article) => (
              <Card key={article.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {article.draftArticle?.title || 'タイトル未設定'}
                        </CardTitle>
                        {getStatusBadge(article.status)}
                      </div>
                      {article.draftArticle?.lead && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">
                          {article.draftArticle.lead}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Link href={`/dashboard/articles/${article.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <EditIcon className="w-4 h-4 mr-2" />
                          編集
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(article.id)}
                        disabled={deletingId === article.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === article.id ? (
                          <LoaderIcon className="w-4 h-4 animate-spin" />
                        ) : (
                          <TrashIcon className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>作成日: {formatDate(article.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>更新日: {formatDate(article.updatedAt)}</span>
                    </div>
                    {article.interviewId && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <LinkIcon className="w-4 h-4" />
                        <Link
                          href={`/dashboard/interviews/${article.interviewId}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          インタビューを表示
                        </Link>
                      </div>
                    )}
                  </div>
                  {article.submittedAt && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      提出日: {formatDate(article.submittedAt)}
                    </div>
                  )}
                  {article.approvedAt && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      承認日: {formatDate(article.approvedAt)}
                    </div>
                  )}
                  {article.publicMeta?.publishedAt && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      公開日: {formatDate(article.publicMeta.publishedAt)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


