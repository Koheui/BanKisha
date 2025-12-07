'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getArticle, updateArticle } from '@/src/lib/firestore'
import { useAuth } from '@/components/auth/AuthProvider'
import type { Article } from '@/src/types'
import {
  SaveIcon,
  ArrowLeftIcon,
  SendIcon,
  EyeIcon,
  LoaderIcon,
  AlertCircleIcon,
  FileTextIcon
} from 'lucide-react'

interface ArticleEditorProps {
  articleId: string
}

export function ArticleEditor({ articleId }: ArticleEditorProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [lead, setLead] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [snsX, setSnsX] = useState('')
  const [snsLinkedIn, setSnsLinkedIn] = useState('')

  useEffect(() => {
    loadArticle()
  }, [articleId])

  const loadArticle = async () => {
    try {
      setLoading(true)
      const articleData = await getArticle(articleId)
      
      if (!articleData) {
        setError('記事が見つかりません')
        return
      }

      // Check permissions
      if (user?.role !== 'admin' && articleData.companyId !== user?.companyId) {
        setError('この記事を編集する権限がありません')
        return
      }

      setArticle(articleData)
      
      // Set form values
      const articleContent = articleData.finalArticle || articleData.draftArticle
      setTitle(articleContent.title || '')
      setLead(articleContent.lead || '')
      setBodyMd(articleContent.bodyMd || '')
      setSnsX(articleData.snsDraft.x140 || '')
      setSnsLinkedIn(articleData.snsDraft.linkedin300 || '')

      setError(null)
    } catch (err) {
      console.error('Error loading article:', err)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const updatedDraft = {
        title,
        lead,
        bodyMd,
        headings: extractHeadings(bodyMd)
      }

      await updateArticle(articleId, {
        draftArticle: updatedDraft,
        snsDraft: {
          x140: snsX,
          linkedin300: snsLinkedIn
        },
        updatedAt: new Date()
      })

      // Show success message (you can use toast here)
      alert('保存しました')
    } catch (err) {
      console.error('Error saving article:', err)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError(null)

      // Save first
      await handleSave()

      // Update status to submitted
      await updateArticle(articleId, {
        status: 'submitted',
        updatedAt: new Date()
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      console.error('Error submitting article:', err)
      setError('申請に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const extractHeadings = (markdown: string): string[] => {
    const headingRegex = /^#+\s+(.+)/gm
    const matches = []
    let match
    
    while ((match = headingRegex.exec(markdown)) !== null) {
      matches.push(match[1].trim())
    }
    
    return matches
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">記事を読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  if (error && !article) {
    return (
      <Card>
        <CardHeader>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-red-600 dark:text-red-400">エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">記事を編集</h1>
          <p className="text-gray-600 dark:text-gray-400">
            記事の内容を編集して、承認申請を送信できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={article.status === 'draft' ? 'draft' : 'submitted'}>
            {article.status === 'draft' ? '下書き' : '申請中'}
          </Badge>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Article Title */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="w-6 h-6" />
            記事タイトル
          </CardTitle>
          <CardDescription>
            38字以内で入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="記事のタイトルを入力"
            maxLength={38}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {title.length} / 38 文字
          </p>
        </CardContent>
      </Card>

      {/* Article Lead */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>リード文</CardTitle>
          <CardDescription>
            記事の冒頭に表示される要約文（200字以内）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            className="w-full min-h-[120px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="記事のリード文を入力..."
            maxLength={200}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {lead.length} / 200 文字
          </p>
        </CardContent>
      </Card>

      {/* Article Body */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>記事本文</CardTitle>
          <CardDescription>
            Markdown形式で記述できます。見出しは # で始めてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            className="w-full min-h-[400px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
            placeholder="# 見出し1&#10;&#10;本文をここに記述..."
          />
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">Markdown記法の例:</h3>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li><code># 見出し1</code></li>
              <li><code>## 見出し2</code></li>
              <li><code>**太字**</code> または <code>*斜体*</code></li>
              <li><code>- リスト項目</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* SNS Drafts */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>SNS投稿文</CardTitle>
          <CardDescription>
            記事公開時に使用されるSNS投稿文
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              X (Twitter) - 140字以内
            </label>
            <textarea
              value={snsX}
              onChange={(e) => setSnsX(e.target.value)}
              className="w-full min-h-[80px] px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="X用の投稿文を入力..."
              maxLength={140}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {snsX.length} / 140 文字
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LinkedIn - 300字以内
            </label>
            <textarea
              value={snsLinkedIn}
              onChange={(e) => setSnsLinkedIn(e.target.value)}
              className="w-full min-h-[120px] px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="LinkedIn用の投稿文を入力..."
              maxLength={300}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {snsLinkedIn.length} / 300 文字
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              onClick={handleSave}
              variant="outline"
              size="lg"
              disabled={saving || submitting}
            >
              {saving ? (
                <>
                  <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <SaveIcon className="w-5 h-5 mr-2" />
                  下書き保存
                </>
              )}
            </Button>

            {article.status === 'draft' && (
              <Button
                onClick={handleSubmit}
                variant="gradient"
                size="lg"
                disabled={saving || submitting || !title.trim() || !lead.trim() || !bodyMd.trim()}
              >
                {submitting ? (
                  <>
                    <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                    申請中...
                  </>
                ) : (
                  <>
                    <SendIcon className="w-5 h-5 mr-2" />
                    承認申請を送信
                  </>
                )}
              </Button>
            )}

            {article.status === 'submitted' && (
              <Badge variant="submitted" className="px-4 py-2">
                承認待ちです
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
