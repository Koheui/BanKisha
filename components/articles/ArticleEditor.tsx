'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb, getFirebaseStorage } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  LoaderIcon,
  SaveIcon,
  ImageIcon,
  XIcon,
  UploadIcon,
  TrashIcon,
  PlusIcon,
  SparklesIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  GlobeIcon,
  BuildingIcon
} from 'lucide-react'
import Link from 'next/link'
import type { Article, ArticleSection, AIMetadata } from '@/src/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ArticleEditorProps {
  articleId: string
}

interface ImageData {
  id: string
  url: string
  alt?: string
  position: number // セクションのインデックス（-1はカバー画像）
}

export function ArticleEditor({ articleId }: ArticleEditorProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingMeta, setGeneratingMeta] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [article, setArticle] = useState<Article | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [companyProfile, setCompanyProfile] = useState<{ label: string, value: string }[]>([])

  // 編集用の一時状態
  const [editTitle, setEditTitle] = useState('')
  const [editLead, setEditLead] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editSections, setEditSections] = useState<ArticleSection[]>([])
  const [selectedSection, setSelectedSection] = useState<number>(-1) // -1はカバー画像

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  const loadArticle = async () => {
    try {
      setLoading(true)
      setError(null)

      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'articles', articleId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        const articleData = {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Article

        setArticle(articleData)
        setEditTitle(articleData.draftArticle.title)
        setEditLead(articleData.draftArticle.lead)
        setEditSlug(articleData.slug || '')
        setEditSections(articleData.draftArticle.sections)

        // Company profile prefilling
        if (articleData.companyProfile && Array.isArray(articleData.companyProfile)) {
          setCompanyProfile(articleData.companyProfile)
        } else if (articleData.interviewId) {
          try {
            const firestoreDb = getFirebaseDb()
            const interviewDoc = await getDoc(doc(firestoreDb, 'interviews', articleData.interviewId))
            if (interviewDoc.exists()) {
              const iData = interviewDoc.data() as any
              const info = iData.intervieweeCompanyInfo
              const items: { label: string, value: string }[] = []
              if (info) {
                if (info.serviceName) items.push({ label: 'サービス名', value: info.serviceName })
                if (info.companyName) items.push({ label: '会社名', value: info.companyName })
                if (info.address) items.push({ label: '住所', value: info.address })
                if (info.url) items.push({ label: 'URL', value: info.url })
                if (Array.isArray(info.items)) {
                  for (const it of info.items) {
                    if (it && (it.label || it.value)) items.push({ label: it.label || '', value: it.value || '' })
                  }
                }
                if (items.length > 0) setCompanyProfile(items)
              }
            }
          } catch (e) {
            console.warn('Failed to prefill companyProfile from interview:', e)
          }
        }

        // 画像データを読み込む（article.imagesフィールドから）
        if (data.images && Array.isArray(data.images)) {
          setImages(data.images)
        }
      } else {
        setError('記事が見つかりません')
      }
    } catch (error) {
      console.error('Error loading article:', error)
      setError('記事の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (file: File, position: number) => {
    if (!article || !user?.companyId) return

    try {
      setUploading(true)
      setError(null)

      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        setError('画像サイズは5MB以下にしてください')
        return
      }

      // ファイルタイプチェック
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルを選択してください')
        return
      }

      // Firebase Storageにアップロード
      const timestamp = Date.now()
      const fileName = `${articleId}/${position === -1 ? 'cover' : `section-${position}`}-${timestamp}.${file.name.split('.').pop()}`
      const firebaseStorage = getFirebaseStorage()
      const storageRef = ref(firebaseStorage, `articles/${fileName}`)

      await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(storageRef)

      // 画像データを追加
      const newImage: ImageData = {
        id: `img-${timestamp}`,
        url: downloadURL,
        alt: '',
        position: position
      }

      const updatedImages = [...images, newImage]
      setImages(updatedImages)

      // Firestoreに保存
      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), {
        images: updatedImages,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      setError('画像のアップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleImageDelete = async (imageId: string) => {
    if (!article) return

    try {
      setError(null)

      const imageToDelete = images.find(img => img.id === imageId)
      if (!imageToDelete) return

      // Firebase Storageから削除
      try {
        // URLからストレージパスを抽出
        const url = imageToDelete.url
        const pathMatch = url.match(/\/o\/(.+)\?/)
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1])
          const firebaseStorage = getFirebaseStorage()
          const storageRef = ref(firebaseStorage, storagePath)
          await deleteObject(storageRef)
        }
      } catch (deleteError) {
        console.warn('Error deleting from storage:', deleteError)
        // ストレージからの削除に失敗しても続行
      }

      // 画像データから削除
      const updatedImages = images.filter(img => img.id !== imageId)
      setImages(updatedImages)

      // Firestoreに保存
      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), {
        images: updatedImages,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error deleting image:', error)
      setError('画像の削除に失敗しました')
    }
  }

  const handleUpdateImageAlt = async (imageId: string, alt: string) => {
    if (!article) return

    try {
      const updatedImages = images.map(img =>
        img.id === imageId ? { ...img, alt } : img
      )
      setImages(updatedImages)

      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), {
        images: updatedImages,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error updating image alt:', error)
      setError('画像の説明文の更新に失敗しました')
    }
  }

  // Company profile helpers
  const addCompanyProfileRow = () => {
    setCompanyProfile(prev => [...prev, { label: '', value: '' }])
  }

  const updateCompanyProfileRow = (index: number, key: 'label' | 'value', val: string) => {
    setCompanyProfile(prev => prev.map((r, i) => i === index ? { ...r, [key]: val } : r))
  }

  const removeCompanyProfileRow = (index: number) => {
    setCompanyProfile(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveArticle = async () => {
    if (!article) return

    try {
      setSaving(true)
      setError(null)

      const updates: any = {
        draftArticle: {
          title: editTitle,
          lead: editLead,
          sections: editSections
        },
        slug: editSlug,
        companyProfile: companyProfile,
        updatedAt: new Date()
      }

      // ownerUserIdがなければ設定（後方互換性）
      if (!article.ownerUserId && user) {
        updates.ownerUserId = user.uid
      }

      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), updates)

      setArticle({
        ...article,
        ...updates,
        draftArticle: {
          title: editTitle,
          lead: editLead,
          sections: editSections
        }
      })

      alert('✅ 記事を保存しました！')
    } catch (error) {
      console.error('Error saving article:', error)
      setError('記事の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateMetadata = async () => {
    if (!articleId) return

    try {
      setGeneratingMeta(true)
      setError(null)

      const response = await fetch('/api/article/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'メタデータの生成に失敗しました')
      }

      const data = await response.json()
      setArticle(prev => prev ? { ...prev, aiMetadata: data.metadata } : null)
      alert('✅ AIメタデータを生成しました！')
    } catch (error) {
      console.error('Error generating metadata:', error)
      setError(error instanceof Error ? error.message : 'メタデータの生成に失敗しました')
    } finally {
      setGeneratingMeta(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">下書き</span>
      case 'review': return <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">審査中</span>
      case 'submitted': return <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs rounded-full">承認申請中</span>
      case 'approved': return <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">承認済み</span>
      case 'published': return <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">公開済み</span>
      case 'public': return <span className="px-2 py-1 bg-green-200 text-green-700 text-xs rounded-full">メディア公開中</span>
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{status}</span>
    }
  }

  const handleUpdateStatus = async (newStatus: Article['status']) => {
    if (!article) return

    try {
      setSaving(true)
      setError(null)

      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), {
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'published' ? { publishedAt: new Date() } : {})
      })

      setArticle({ ...article, status: newStatus })
      alert(`✅ ステータスを「${newStatus}」に更新しました`)
    } catch (error) {
      console.error('Error updating status:', error)
      setError('ステータスの更新に失敗しました')
    } finally {
      setSaving(false)
    }
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

  if (error && !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return null
  }

  const coverImage = images.find(img => img.position === -1)
  const sectionImages = article.draftArticle.sections.map((_, idx) =>
    images.filter(img => img.position === idx)
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                <span>記事を編集</span>
              </h1>
              {getStatusBadge(article.status)}
              <Link
                href={`/articles/${articleId}`}
                target="_blank"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 ml-2"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                プレビュー
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {article.status === 'draft' && (
                <Button
                  onClick={() => handleUpdateStatus('review')}
                  disabled={saving || generatingMeta}
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  審査を依頼
                </Button>
              )}
              {article.status === 'review' && (user?.role === 'admin' || user?.role === 'superAdmin') && (
                <Button
                  onClick={() => handleUpdateStatus('published')}
                  disabled={saving || generatingMeta}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <UploadIcon className="w-4 h-4 mr-2" />
                  公開する
                </Button>
              )}
              {(article.status === 'approved' || article.status === 'published') && (
                <Link href={`/media/publish/${articleId}`}>
                  <Button
                    disabled={saving || generatingMeta}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <GlobeIcon className="w-4 h-4 mr-2" />
                    メディアに公開
                  </Button>
                </Link>
              )}
              {article.status === 'published' && (user?.role === 'admin' || user?.role === 'superAdmin') && (
                <Button
                  onClick={() => handleUpdateStatus('draft')}
                  disabled={saving || generatingMeta}
                  variant="outline"
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  <XIcon className="w-4 h-4 mr-2" />
                  非公開にする
                </Button>
              )}
              {article.status === 'public' && (
                <Link href={`/media/articles/${articleId}`} target="_blank">
                  <Button
                    variant="outline"
                    className="border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <GlobeIcon className="w-4 h-4 mr-2" />
                    メディアサイトで見る
                  </Button>
                </Link>
              )}

              <Button
                onClick={handleGenerateMetadata}
                disabled={generatingMeta || saving}
                variant="outline"
                className="border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                {generatingMeta ? (
                  <>
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    AI仕訳
                  </>
                )}
              </Button>

              <Button
                onClick={handleSaveArticle}
                disabled={saving || generatingMeta}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {saving ? (
                  <>
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 会社・サービス概要カード */}
        <Card className="mb-6 border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-blue-600" />
              <span>会社・サービス概要（Company Profile）</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {companyProfile.map((row, idx) => (
                <div key={idx} className="flex gap-2 group">
                  <Input
                    className="w-1/3 bg-white dark:bg-gray-800"
                    placeholder="項目名"
                    value={row.label}
                    onChange={(e) => updateCompanyProfileRow(idx, 'label', e.target.value)}
                  />
                  <Input
                    className="flex-1 bg-white dark:bg-gray-800"
                    placeholder="値"
                    value={row.value}
                    onChange={(e) => updateCompanyProfileRow(idx, 'value', e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCompanyProfileRow(idx)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <Button onClick={addCompanyProfileRow} variant="outline" size="sm" className="gap-2">
                  <PlusIcon className="w-4 h-4" />
                  <span>項目を追加</span>
                </Button>
                <p className="text-[10px] text-gray-400 italic">保存は右上の「保存」ボタンで行われます</p>
              </div>

              {companyProfile.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg bg-gray-50/50 dark:bg-gray-800/20">
                  <p className="text-xs text-gray-400">会社情報が設定されていません</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Cover Image */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>カバー画像</CardTitle>
          </CardHeader>
          <CardContent>
            {coverImage ? (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={coverImage.url}
                    alt={coverImage.alt || 'カバー画像'}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleImageDelete(coverImage.id)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    画像の説明（alt属性）
                  </label>
                  <Textarea
                    value={coverImage.alt || ''}
                    onChange={(e) => handleUpdateImageAlt(coverImage.id, e.target.value)}
                    placeholder="画像の説明を入力..."
                    rows={2}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  カバー画像をアップロード
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImageUpload(file, -1)
                    }
                  }}
                  disabled={uploading}
                  className="hidden"
                  id="cover-image-upload"
                />
                <label
                  htmlFor="cover-image-upload"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                >
                  {uploading ? (
                    <LoaderIcon className="w-8 h-8 animate-spin text-blue-600" />
                  ) : (
                    <div className="text-center">
                      <UploadIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        クリックして画像をアップロード
                      </p>
                    </div>
                  )}
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Article Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>記事内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                タイトル
              </label>
              <Textarea
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold w-full"
                rows={2}
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                スラッグ (URL)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">/articles/</span>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 text-sm font-mono"
                  placeholder="article-slug-here"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                SEOに使用されます。英数字とハイフンを推奨します。
              </p>
            </div>

            {/* Lead */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                リード文
              </label>
              <Textarea
                value={editLead}
                onChange={(e) => setEditLead(e.target.value)}
                className="text-lg w-full leading-relaxed"
                rows={4}
              />
            </div>

            {/* Sections */}
            {editSections.map((section: ArticleSection, idx: number) => (
              <div key={idx} className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    セクション見出し
                  </label>
                  <input
                    type="text"
                    value={section.heading}
                    onChange={(e) => {
                      const newSections = [...editSections]
                      newSections[idx] = { ...section, heading: e.target.value }
                      setEditSections(newSections)
                    }}
                    className="text-xl font-semibold w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                  />
                </div>

                {/* Section Images */}
                {sectionImages[idx] && sectionImages[idx].length > 0 && (
                  <div className="space-y-4">
                    {sectionImages[idx].map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={img.url}
                          alt={img.alt || section.heading}
                          className="w-full rounded-lg"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => handleImageDelete(img.id)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                        <div className="mt-2">
                          <Textarea
                            value={img.alt || ''}
                            onChange={(e) => handleUpdateImageAlt(img.id, e.target.value)}
                            placeholder="画像の説明を入力..."
                            rows={2}
                            className="w-full text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Image Button */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(file, idx)
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                    id={`section-image-upload-${idx}`}
                  />
                  <label
                    htmlFor={`section-image-upload-${idx}`}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {uploading ? (
                      <LoaderIcon className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">画像を追加</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    本文
                  </label>
                  <Textarea
                    value={section.body}
                    onChange={(e) => {
                      const newSections = [...editSections]
                      newSections[idx] = { ...section, body: e.target.value }
                      setEditSections(newSections)
                    }}
                    className="w-full min-h-[200px] leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Metadata Display */}
        {article.aiMetadata && (
          <Card className="mb-6 border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <SparklesIcon className="w-5 h-5" />
                AIによる分析（仕訳）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">要約（短）</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{article.aiMetadata.summaryShort}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">ターゲット層</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                      レベル: {article.aiMetadata.audienceLevel}
                    </span>
                    {article.aiMetadata.intent.map((it, i) => (
                      <span key={i} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded">
                        意図: {it}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">主要トピック</h4>
                  <div className="flex flex-wrap gap-2">
                    {article.aiMetadata.topics.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">業界</h4>
                  <div className="flex flex-wrap gap-2">
                    {article.aiMetadata.industry.map((ind, i) => (
                      <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">品質シグナル</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    {article.aiMetadata.qualitySignals.firstPerson ? <CheckCircleIcon className="w-3 h-3 text-green-500" /> : <AlertCircleIcon className="w-3 h-3 text-gray-400" />} 一人称
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    {article.aiMetadata.qualitySignals.hasNumbers ? <CheckCircleIcon className="w-3 h-3 text-green-500" /> : <AlertCircleIcon className="w-3 h-3 text-gray-400" />} 具体的な数値
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    {article.aiMetadata.qualitySignals.hasQuotes ? <CheckCircleIcon className="w-3 h-3 text-green-500" /> : <AlertCircleIcon className="w-3 h-3 text-gray-400" />} 引用・発言
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
