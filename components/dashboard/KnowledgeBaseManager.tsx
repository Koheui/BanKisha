'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getKnowledgeBases, deleteKnowledgeBase } from '@/src/lib/firestore'
import type { KnowledgeBase } from '@/src/types'
import {
  FileTextIcon,
  UploadIcon,
  TrashIcon,
  CheckCircleIcon,
  LoaderIcon,
  AlertCircleIcon,
  BookOpenIcon
} from 'lucide-react'

export function KnowledgeBaseManager() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadKnowledgeBases()
  }, [])

  const loadKnowledgeBases = async () => {
    try {
      const data = await getKnowledgeBases()
      setKnowledgeBases(data)
    } catch (error) {
      console.error('Error loading knowledge bases:', error)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('PDFファイルのみアップロードできます')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace('.pdf', ''))
      formData.append('description', '')

      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('アップロードに失敗しました')
      }

      const data = await response.json()
      setUploadProgress(100)

      // Reload knowledge bases
      await loadKnowledgeBases()

      alert('PDFのアップロードが完了しました。処理中です...')
    } catch (error) {
      console.error('Error uploading PDF:', error)
      alert('PDFのアップロードに失敗しました')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このナレッジベースを削除しますか？関連するチャンクもすべて削除されます。')) {
      return
    }

    try {
      await deleteKnowledgeBase(id)
      await loadKnowledgeBases()
      alert('削除しました')
    } catch (error) {
      console.error('Error deleting knowledge base:', error)
      alert('削除に失敗しました')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">処理完了</Badge>
      case 'processing':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <LoaderIcon className="w-3 h-3 animate-spin" />
            処理中
          </Badge>
        )
      case 'error':
        return <Badge variant="destructive">エラー</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon className="w-6 h-6" />
                ナレッジベース管理
              </CardTitle>
              <CardDescription>
                インタビュー術の書籍PDFをアップロードして、AI番記者のスキルを向上させます
              </CardDescription>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="gradient"
                disabled={uploading}
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                PDFをアップロード
              </Button>
            </div>
          </div>
        </CardHeader>
        {uploading && (
          <CardContent>
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                アップロード中... {uploadProgress}%
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Knowledge Bases List */}
      {knowledgeBases.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileTextIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ナレッジベースがありません
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              インタビュー術の書籍PDFをアップロードして、AI番記者のスキルを向上させましょう
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="gradient"
            >
              <UploadIcon className="w-5 h-5 mr-2" />
              最初のPDFをアップロード
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {knowledgeBases.map((kb) => (
            <Card key={kb.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{kb.title}</CardTitle>
                    {kb.description && (
                      <CardDescription className="line-clamp-2">
                        {kb.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(kb.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(kb.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>ページ数:</span>
                    <span className="font-medium">{kb.pageCount || 0} ページ</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ファイルサイズ:</span>
                    <span className="font-medium">
                      {(kb.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {kb.processedAt && (
                    <div className="flex items-center justify-between">
                      <span>処理日時:</span>
                      <span className="font-medium text-xs">
                        {new Date(kb.processedAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="border-0 shadow-md bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <BookOpenIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                ナレッジベースについて
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                インタビュー術に関する書籍のPDFをアップロードすると、AI番記者がその内容を学習し、
                より効果的な質問や記事執筆ができるようになります。
                アップロードされたPDFは自動的にテキスト抽出され、ベクトル検索可能な形式で保存されます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
