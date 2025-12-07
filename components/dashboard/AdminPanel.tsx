'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getArticles, getCompanies, updateArticle } from '@/src/lib/firestore'
import { formatDate } from '@/src/lib/utils'
import type { Article, Company } from '@/src/types'
import {
  FileTextIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  BuildingIcon,
  LoaderIcon,
  ShieldCheckIcon
} from 'lucide-react'
import { KnowledgeBaseManager } from './KnowledgeBaseManager'

interface AdminPanelProps {
  onStatsUpdate?: (stats: { drafts: number; submitted: number; approved: number; public: number }) => void
}

export function AdminPanel({ onStatsUpdate }: AdminPanelProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'public'>('submitted')

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [articlesData, companiesData] = await Promise.all([
        getArticles(filter === 'all' ? undefined : filter),
        getCompanies()
      ])
      
      setArticles(articlesData)
      setCompanies(companiesData)

      // Update stats
      if (onStatsUpdate) {
        const stats = {
          drafts: articlesData.filter(a => a.status === 'draft').length,
          submitted: articlesData.filter(a => a.status === 'submitted').length,
          approved: articlesData.filter(a => a.status === 'approved').length,
          public: articlesData.filter(a => a.status === 'public').length
        }
        onStatsUpdate(stats)
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (articleId: string) => {
    try {
      await updateArticle(articleId, { status: 'approved' })
      loadData()
    } catch (err) {
      console.error('Error approving article:', err)
    }
  }

  const handlePublish = async (articleId: string) => {
    try {
      await updateArticle(articleId, {
        status: 'public',
        publicMeta: {
          publishedAt: new Date(),
          byline: 'BanKisha編集部',
          mediaBadge: 'BanKisha'
        }
      })
      loadData()
    } catch (err) {
      console.error('Error publishing article:', err)
    }
  }

  const handleReject = async (articleId: string) => {
    try {
      await updateArticle(articleId, { status: 'draft' })
      loadData()
    } catch (err) {
      console.error('Error rejecting article:', err)
    }
  }

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId)
    return company?.name || '不明な企業'
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

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">管理者パネル</CardTitle>
              <CardDescription>
                すべての記事を管理・承認・公開できます
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filter Tabs */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="w-6 h-6" />
            記事管理
          </CardTitle>
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
              {articles.filter(a => a.status === 'submitted').length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {articles.filter(a => a.status === 'submitted').length}
                </Badge>
              )}
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
              {filter === 'all' ? '記事がありません' : `${getStatusLabel(filter)}の記事がありません`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {articles.map((article) => (
            <Card key={article.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(article.status)}
                      <Badge variant="outline" className="flex items-center gap-1">
                        <BuildingIcon className="w-3 h-3" />
                        {getCompanyName(article.companyId)}
                      </Badge>
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
                  <Link href={`/dashboard/articles/${article.id}/preview`}>
                    <Button variant="outline" size="sm">
                      <EyeIcon className="w-4 h-4 mr-2" />
                      プレビュー
                    </Button>
                  </Link>

                  {article.status === 'submitted' && (
                    <>
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={() => handleApprove(article.id)}
                      >
                        <CheckIcon className="w-4 h-4 mr-2" />
                        承認
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleReject(article.id)}
                      >
                        <XIcon className="w-4 h-4 mr-2" />
                        差し戻し
                      </Button>
                    </>
                  )}

                  {article.status === 'approved' && (
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={() => handlePublish(article.id)}
                    >
                      <CheckIcon className="w-4 h-4 mr-2" />
                      公開
                    </Button>
                  )}

                  {article.status === 'public' && (
                    <Link href={`/articles/${article.id}`}>
                      <Button variant="gradient" size="sm">
                        <EyeIcon className="w-4 h-4 mr-2" />
                        公開記事を見る
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Companies Section */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingIcon className="w-6 h-6" />
            企業一覧
          </CardTitle>
          <CardDescription>
            登録されている企業の情報
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">
              企業がまだ登録されていません
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt={company.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <BuildingIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {company.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {company.onboarded ? '取材完了' : '未取材'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base Management */}
      <KnowledgeBaseManager />
    </div>
  )
}
