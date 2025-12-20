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
  TrashIcon
} from 'lucide-react'
import type { Article, ArticleSection } from '@/src/types'

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
  const [uploading, setUploading] = useState(false)
  const [article, setArticle] = useState<Article | null>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const [error, setError] = useState<string | null>(null)
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
        setArticle({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Article)

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

  const handleSaveArticle = async () => {
    if (!article) return

    try {
      setSaving(true)
      setError(null)

      await updateDoc(doc(getFirebaseDb(), 'articles', articleId), {
        draftArticle: article.draftArticle,
        updatedAt: new Date()
      })

      alert('✅ 記事を保存しました！')
    } catch (error) {
      console.error('Error saving article:', error)
      setError('記事の保存に失敗しました')
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
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              記事を編集
            </h1>
            <Button
              onClick={handleSaveArticle}
              disabled={saving}
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {article.draftArticle.title}
              </h2>
            </div>

            {/* Lead */}
            <div>
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {article.draftArticle.lead}
              </p>
            </div>

            {/* Sections */}
            {article.draftArticle.sections.map((section: ArticleSection, idx: number) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {section.heading}
                </h3>

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
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
