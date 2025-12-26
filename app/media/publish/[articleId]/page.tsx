'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getArticle, updateArticle, getCompany } from '@/src/lib/firestore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LoaderIcon,
  GlobeIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { Article } from '@/src/types'

function PublishArticleContent() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const articleId = params?.articleId as string

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [publishSummary, setPublishSummary] = useState('')
  const [publishCategory, setPublishCategory] = useState('')
  const [companyName, setCompanyName] = useState<string>('BanKisha編集部')

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  useEffect(() => {
    // 未ログインの場合は登録画面にリダイレクト
    if (!authLoading && !user && articleId) {
      const currentPath = `/media/publish/${articleId}`
      router.push(`/signup?redirect=${encodeURIComponent(currentPath)}`)
    }
  }, [user, authLoading, articleId, router])

  const loadArticle = async () => {
    try {
      setLoading(true)
      setError(null)

      const articleData = await getArticle(articleId)

      if (!articleData) {
        setError('記事が見つかりません')
        return
      }

      // status='public' の記事は既に公開済み
      if (articleData.status === 'public') {
        setPublished(true)
        setArticle(articleData)
        return
      }

      setArticle(articleData)
      setPublishSummary(articleData.summary || articleData.draftArticle.lead.substring(0, 100))
      setPublishCategory(articleData.category || 'インタビュー')

      // 会社名を読み込む
      if (articleData.companyId) {
        const company = await getCompany(articleData.companyId)
        if (company) {
          setCompanyName(company.name)
        }
      }
    } catch (err: any) {
      console.error('Error loading article:', err)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!article || !publishCategory) return

    try {
      setPublishing(true)
      setError(null)

      const coverImage = article.images?.find(img => img.position === -1)
      const coverImageUrl = coverImage?.url || article.coverImageUrl || ''

      const now = new Date()
      const updateData: any = {
        status: 'public',
        publishedAt: now,
        summary: publishSummary || article.summary || article.draftArticle.lead.substring(0, 100),
        category: publishCategory,
      }

      if (coverImageUrl) {
        updateData.coverImageUrl = coverImageUrl
      }

      updateData.publicMeta = {
        publishedAt: now,
        coverImageUrl: coverImageUrl,
        summary: publishSummary || article.summary || article.draftArticle.lead.substring(0, 100),
        byline: companyName,
        mediaBadge: 'BanKisha-Kawaraban',
      }

      await updateArticle(articleId, updateData)

      setPublished(true)
    } catch (err: any) {
      console.error('Error publishing article:', err)
      setError('記事の公開に失敗しました')
    } finally {
      setPublishing(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md">
          <CardHeader>
            <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-center text-red-800 dark:text-red-300">
              エラーが発生しました
            </CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                ダッシュボードに戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (published && article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12">
        <Card className="max-w-md">
          <CardHeader>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-center">公開完了</CardTitle>
            <CardDescription className="text-center">
              記事をBanKisha-Kawaraban（番記者瓦版）に公開しました
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={`/media/articles/${articleId}`} target="_blank">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <GlobeIcon className="w-4 h-4 mr-2" />
                公開記事を見る
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                ダッシュボードに戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">BanKisha-Kawaraban（番記者瓦版）に公開</CardTitle>
            <CardDescription>
              記事をメディアサイトに公開します。公開後は一般ユーザーが閲覧できるようになります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Article Preview */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {article.draftArticle.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {article.draftArticle.lead}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            <div>
              <Label htmlFor="publish-summary">記事サマリー（2〜3文、100文字程度）</Label>
              <Textarea
                id="publish-summary"
                value={publishSummary}
                onChange={(e) => setPublishSummary(e.target.value)}
                placeholder="記事のサマリーを入力してください..."
                rows={3}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {publishSummary.length} / 100文字
              </p>
            </div>

            <div>
              <Label htmlFor="publish-category">カテゴリ *</Label>
              <Select value={publishCategory} onValueChange={setPublishCategory}>
                <SelectTrigger id="publish-category" className="mt-2">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="インタビュー">インタビュー</SelectItem>
                  <SelectItem value="ビジネス">ビジネス</SelectItem>
                  <SelectItem value="テクノロジー">テクノロジー</SelectItem>
                  <SelectItem value="スタートアップ">スタートアップ</SelectItem>
                  <SelectItem value="イベント">イベント</SelectItem>
                  <SelectItem value="プレスリリース">プレスリリース</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>注意:</strong> 公開後はBanKisha-Kawaraban（番記者瓦版）（/media/articles/{articleId}）で記事が閲覧可能になります。
              </p>
            </div>

            <div className="flex gap-4">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full" disabled={publishing}>
                  キャンセル
                </Button>
              </Link>
              <Button
                onClick={handlePublish}
                disabled={publishing || !publishCategory}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {publishing ? (
                  <>
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                    公開中...
                  </>
                ) : (
                  <>
                    <GlobeIcon className="w-4 h-4 mr-2" />
                    公開する
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PublishArticlePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <PublishArticleContent />
    </Suspense>
  )
}

