'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/src/lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { KnowledgeBase } from '@/src/types'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  UploadIcon,
  TrashIcon,
  FileIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
  AlertCircleIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  XIcon,
  HistoryIcon,
  RotateCcwIcon
} from 'lucide-react'

const COMPONENT_VERSION = '2024-12-15-SkillKB-v1'

export default function SkillKBPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [feedbackKbId, setFeedbackKbId] = useState<string | null>(null)
  const [feedbackContentType, setFeedbackContentType] = useState<'summary' | 'usageGuide' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackMode, setFeedbackMode] = useState<'add' | 'modify' | 'remove'>('add')
  const [isEditOnly, setIsEditOnly] = useState(false) // 編集時のみ使用するフラグ
  const [regenerating, setRegenerating] = useState(false)
  const [showHistory, setShowHistory] = useState<{kbId: string, type: 'summary' | 'usageGuide'} | null>(null)

  console.log(`🚀 [SkillKB] Version: ${COMPONENT_VERSION}`)

  // superAdminのみアクセス可能
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && user.role !== 'superAdmin') {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // スキルKBの一覧を取得
  useEffect(() => {
    if (!loading && user?.role === 'superAdmin') {
      loadKnowledgeBases()
    }
  }, [loading, user])

  const loadKnowledgeBases = async () => {
    try {
      setLoadingData(true)
      const firestoreDb = getFirebaseDb()
      const kbRef = collection(firestoreDb, 'knowledgeBases')
      const q = query(
        kbRef,
        where('type', '==', 'skill'),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const kbs = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        } as KnowledgeBase))
        .filter(kb => !kb.deleted) // クライアント側で削除されていないものをフィルタ
      setKnowledgeBases(kbs)
    } catch (error) {
      console.error('Error loading knowledge bases:', error)
      alert('❌ ナレッジベースの読み込みに失敗しました')
    } finally {
      setLoadingData(false)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // PDFファイルのみ受け入れる
    if (file.type !== 'application/pdf') {
      alert('❌ PDFファイルのみアップロード可能です')
      return
    }

    // ファイルサイズ制限なし

    try {
      setUploading(true)
      setUploadProgress(0)

      const firebaseAuth = getFirebaseAuth()
      const currentUser = firebaseAuth.currentUser
      if (!currentUser) {
        throw new Error('ログインが必要です')
      }

      const idToken = await currentUser.getIdToken()

      // ファイル名をエンコード
      const timestamp = Date.now()
      const encodedFileName = encodeURIComponent(file.name)
      const firebaseStorage = getFirebaseStorage()
      const storageRef = ref(firebaseStorage, `knowledge-bases/skill/${timestamp}-${encodedFileName}`)

      console.log('📤 [Upload] Starting upload:', {
        file: file.name,
        size: file.size,
        path: storageRef.fullPath
      })

      // Firebase Storageにアップロード
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: 'application/pdf'
      })

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
          console.log(`📊 [Upload] Progress: ${progress.toFixed(1)}%`)
        },
        (error) => {
          console.error('❌ [Upload] Storage error:', error)
          throw error
        },
        async () => {
          try {
            console.log('✅ [Upload] Storage upload complete')
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            console.log('📥 [Upload] Download URL obtained:', downloadURL)

            // Firestore + Firebase Function トリガー
            console.log('📤 [Upload] Creating knowledge base document...')
            const response = await fetch('/api/knowledge-base/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                type: 'skill',
                fileName: file.name,
                fileSize: file.size,
                storageUrl: downloadURL,
                storagePath: uploadTask.snapshot.ref.fullPath
              })
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('❌ [Upload] API error response:', errorData)
              throw new Error(errorData.error || 'ナレッジベースの作成に失敗しました')
            }

            const result = await response.json()
            console.log('✅ [Upload] Success:', result)

            alert('✅ アップロードが完了しました。PDFの処理を開始します。')
            await loadKnowledgeBases()

            // ファイル入力をリセット
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          } catch (error: any) {
            console.error('❌ [Upload] Fatal error:', error)
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              stack: error.stack,
              name: error.name
            })
            throw error
          }
        }
      )
    } catch (error: any) {
      console.error('Error uploading PDF:', error)
      alert(`❌ アップロードに失敗しました: ${error.message}`)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (kb: KnowledgeBase) => {
    if (!confirm(`「${kb.fileName}」をゴミ箱に移動してもよろしいですか？\n\nゴミ箱から復元できます。`)) {
      return
    }

    try {
      // ソフトデリート（論理削除）
      const firestoreDb = getFirebaseDb()
      const kbRef = doc(firestoreDb, 'knowledgeBases', kb.id)
      await updateDoc(kbRef, {
        deleted: true,
        deletedAt: new Date()
      })

      alert('✅ ゴミ箱に移動しました')
      await loadKnowledgeBases()
    } catch (error) {
      console.error('Error deleting KB:', error)
      alert('❌ 削除に失敗しました')
    }
  }

  const handleUsageChange = async (
    kbId: string,
    scenario: 'dialogue' | 'article' | 'summary',
    checked: boolean
  ) => {
    try {
      const firestoreDb = getFirebaseDb()
      const kbRef = doc(firestoreDb, 'knowledgeBases', kbId)

      const updateData: any = {}
      if (scenario === 'dialogue') {
        updateData.useForDialogue = checked
      } else if (scenario === 'article') {
        updateData.useForArticle = checked
      } else if (scenario === 'summary') {
        updateData.useForSummary = checked
      }

      await updateDoc(kbRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      })

      // ローカル状態を更新
      setKnowledgeBases(prev =>
        prev.map(kb =>
          kb.id === kbId
            ? { ...kb, ...updateData }
            : kb
        )
      )
    } catch (error) {
      console.error('Error updating usage scenario:', error)
      alert('❌ 更新に失敗しました')
    }
  }

  const handleFeedbackStart = (kb: KnowledgeBase, contentType: 'summary' | 'usageGuide') => {
    setFeedbackKbId(kb.id)
    setFeedbackContentType(contentType)
    setFeedback('')
    setFeedbackMode('add') // デフォルトは「追加」
  }

  const handleFeedbackCancel = () => {
    setFeedbackKbId(null)
    setFeedbackContentType(null)
    setFeedback('')
    setFeedbackMode('add')
    setIsEditOnly(false)
  }

  const handleRestore = async (kb: KnowledgeBase, contentType: 'summary' | 'usageGuide', version: number) => {
    if (!confirm(`v${version}の内容に復元してもよろしいですか？\n\n現在の内容は履歴に保存されます。`)) {
      return
    }

    try {
      setRegenerating(true)

      const firebaseAuth = getFirebaseAuth()
      const idToken = await firebaseAuth.currentUser?.getIdToken()
      const response = await fetch('/api/knowledge-base/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          knowledgeBaseId: kb.id,
          contentType,
          version,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ API Error:', errorData)
        throw new Error(errorData.error || '復元に失敗しました')
      }

      alert('✅ 復元しました！')
      setShowHistory(null)
      await loadKnowledgeBases()
    } catch (error) {
      console.error('Error restoring:', error)
      alert(`❌ 復元に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRegenerate = async (kb: KnowledgeBase) => {
    if (!feedbackContentType || !feedback.trim()) {
      alert('⚠️ フィードバックを入力してください')
      return
    }

    try {
      setRegenerating(true)

      const firebaseAuth = getFirebaseAuth()
      const idToken = await firebaseAuth.currentUser?.getIdToken()
      const response = await fetch('/api/knowledge-base/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          knowledgeBaseId: kb.id,
          contentType: feedbackContentType,
          feedback: feedback.trim(),
          feedbackMode: feedbackMode,
          isEditOnly: isEditOnly, // 編集時のみ使用フラグ
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ API Error:', errorData)
        throw new Error(errorData.error || '再生成に失敗しました')
      }

      const data = await response.json()
      console.log('✅ Regeneration success:', data)

      alert('✅ 再生成しました！')
      handleFeedbackCancel()
      await loadKnowledgeBases()
    } catch (error) {
      console.error('Error regenerating:', error)
      alert(`❌ 再生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setRegenerating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'indexed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
            <CheckCircleIcon className="w-4 h-4" />
            <span>処理完了</span>
          </div>
        )
      case 'processing':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
            <LoaderIcon className="w-4 h-4 animate-spin" />
            <span>処理中</span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
            <XCircleIcon className="w-4 h-4" />
            <span>失敗</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-sm font-medium">
            <AlertCircleIcon className="w-4 h-4" />
            <span>{status}</span>
          </div>
        )
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'superAdmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">アクセス権限がありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <div className="flex items-center gap-3">
                <BookOpenIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  🔴 スキルナレッジベース管理
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-full border border-red-300 dark:border-red-700">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-900 dark:text-red-300">Super Admin専用</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Description */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            スキルナレッジベース（Skill KB）について
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            スキルKBは、インタビューの基礎知識（聞き方、深掘り、要約、沈黙、編集術など）を格納します。
            ここにアップロードされたPDFは、全ユーザーのAIインタビュアーが参照し、会話技術として「内在化」されます。
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 重要事項</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• PDFファイルのみアップロード可能（サイズ制限なし）</li>
              <li>• アップロード後、自動的にテキスト抽出・チャンク分割・埋め込み処理が行われます</li>
              <li>• 処理には数分かかることがあります</li>
              <li>• スキルKBの内容は、すべてのユーザーのAIインタビュアーに影響します</li>
            </ul>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            新しいスキルKBをアップロード
          </h2>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <UploadIcon className="w-5 h-5" />
              {uploading ? 'アップロード中...' : 'PDFファイルを選択'}
            </button>
            {uploading && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {uploadProgress < 100
                    ? `アップロード中: ${uploadProgress.toFixed(1)}%`
                    : 'ナレッジベースを作成中...'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Bases List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            スキルKB一覧（{knowledgeBases.length}件）
          </h2>
          {knowledgeBases.length === 0 ? (
            <div className="text-center py-12">
              <FileIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                スキルKBがまだ登録されていません
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                上記のボタンからPDFファイルをアップロードしてください
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-red-300 dark:hover:border-red-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {kb.fileName}
                        </h3>
                        {getStatusBadge(kb.status)}
                      </div>
                      <div className="ml-8 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p>サイズ: {formatFileSize(kb.fileSize)}</p>
                        <p>アップロード日時: {formatDate(kb.createdAt)}</p>
                        {(kb.status === 'indexed' || kb.status === 'ready') && (
                          <>
                            {kb.pageCount && <p>ページ数: {kb.pageCount}</p>}
                            {kb.chunkCount && <p>チャンク数: {kb.chunkCount}</p>}
                            {/* 活用方法のチェックボックス */}
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                活用方法
                              </label>
                              <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={kb.useForDialogue ?? true}
                                    onChange={(e) => handleUsageChange(kb.id, 'dialogue', e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 focus:ring-2"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">対話術</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={kb.useForArticle ?? false}
                                    onChange={(e) => handleUsageChange(kb.id, 'article', e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 focus:ring-2"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">記事作成</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={kb.useForSummary ?? false}
                                    onChange={(e) => handleUsageChange(kb.id, 'summary', e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 focus:ring-2"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">サマリー作成</span>
                                </label>
                              </div>
                            </div>
                            {kb.summary && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                  📝 AIが読み取った内容の概要:
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                                  {kb.summary}
                                </p>
                                
                                {/* 履歴表示 */}
                                {kb.summaryHistory && kb.summaryHistory.length > 0 && (
                                  <div className="mt-2 mb-3">
                                    <button
                                      onClick={() => setShowHistory(showHistory?.kbId === kb.id && showHistory.type === 'summary' ? null : { kbId: kb.id, type: 'summary' })}
                                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      <HistoryIcon className="w-3 h-3" />
                                      <span>変更履歴を表示（{kb.summaryHistory.length}件）</span>
                                    </button>
                                    {showHistory?.kbId === kb.id && showHistory.type === 'summary' && (
                                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                        {kb.summaryHistory.slice().reverse().map((version, index) => (
                                          <div key={index} className="text-xs border border-blue-200 dark:border-blue-700 rounded p-2 bg-blue-50/50 dark:bg-blue-900/10">
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-blue-800 dark:text-blue-300">
                                                  v{version.version}
                                                </span>
                                                <span className="text-gray-600 dark:text-gray-400">
                                                  {version.feedbackType === 'add' ? '✅ 追加' : version.feedbackType === 'modify' ? '✏️ 修正' : version.feedbackType === 'remove' ? '❌ 削除' : '🔄 完全置換'}
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-500">
                                                  {new Date(version.createdAt).toLocaleString('ja-JP')}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => handleRestore(kb, 'summary', version.version)}
                                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                              >
                                                <RotateCcwIcon className="w-3 h-3" />
                                                <span>復元</span>
                                              </button>
                                            </div>
                                            {version.feedback && (
                                              <p className="text-gray-700 dark:text-gray-400 mb-2 italic">
                                                「{version.feedback}」
                                              </p>
                                            )}
                                            <details className="text-gray-600 dark:text-gray-400">
                                              <summary className="cursor-pointer hover:text-blue-600">内容を表示</summary>
                                              <p className="mt-1 whitespace-pre-wrap">{version.content}</p>
                                            </details>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {feedbackKbId === kb.id && feedbackContentType === 'summary' ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-semibold text-blue-800 dark:text-blue-400">
                                        フィードバックのタイプ:
                                      </label>
                                      <select
                                        value={feedbackMode}
                                        onChange={(e) => setFeedbackMode(e.target.value as 'add' | 'modify' | 'remove')}
                                        className="text-xs border border-blue-300 dark:border-blue-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                                      >
                                        <option value="add">✅ 追加（既存を保持して新しい観点を追加）</option>
                                        <option value="modify">✏️ 修正（特定の部分を改善）</option>
                                        <option value="remove">❌ 削除（不要な部分を削除）</option>
                                      </select>
                                    </div>
                                    <textarea
                                      value={feedback}
                                      onChange={(e) => setFeedback(e.target.value)}
                                      rows={3}
                                      placeholder={
                                        feedbackMode === 'add' 
                                          ? '追加したい観点を入力（例：ビジネス向けの観点も含めて）' 
                                          : feedbackMode === 'modify' 
                                          ? '修正したい部分を指定（例：〇〇の部分をもっと具体的に）' 
                                          : '削除したい部分を指定（例：〇〇の説明は不要）'
                                      }
                                      className="w-full text-sm text-gray-700 dark:text-gray-300 border border-blue-300 dark:border-blue-600 rounded p-2 bg-white dark:bg-gray-800"
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRegenerate(kb)}
                                        disabled={regenerating || !feedback.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                                      >
                                        <RefreshCwIcon className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                                        <span>{regenerating ? '再生成中...' : 'フィードバックを元に再生成'}</span>
                                      </button>
                                      <button
                                        onClick={handleFeedbackCancel}
                                        disabled={regenerating}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
                                      >
                                        <XIcon className="w-3 h-3" />
                                        <span>キャンセル</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleFeedbackStart(kb, 'summary')}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 text-xs"
                                  >
                                    <MessageSquareIcon className="w-3 h-3" />
                                    <span>💬 改善提案を追加</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {kb.usageGuide && (
                              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                                    💡 活用方法:
                                  </p>
                                  {kb.isEditOnly && (
                                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                      📝 編集時のみ使用
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                                  {kb.usageGuide}
                                </p>
                                
                                {/* 履歴表示 */}
                                {kb.usageGuideHistory && kb.usageGuideHistory.length > 0 && (
                                  <div className="mt-2 mb-3">
                                    <button
                                      onClick={() => setShowHistory(showHistory?.kbId === kb.id && showHistory.type === 'usageGuide' ? null : { kbId: kb.id, type: 'usageGuide' })}
                                      className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                                    >
                                      <HistoryIcon className="w-3 h-3" />
                                      <span>変更履歴を表示（{kb.usageGuideHistory.length}件）</span>
                                    </button>
                                    {showHistory?.kbId === kb.id && showHistory.type === 'usageGuide' && (
                                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                        {kb.usageGuideHistory.slice().reverse().map((version, index) => (
                                          <div key={index} className="text-xs border border-green-200 dark:border-green-700 rounded p-2 bg-green-50/50 dark:bg-green-900/10">
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-green-800 dark:text-green-300">
                                                  v{version.version}
                                                </span>
                                                <span className="text-gray-600 dark:text-gray-400">
                                                  {version.feedbackType === 'add' ? '✅ 追加' : version.feedbackType === 'modify' ? '✏️ 修正' : version.feedbackType === 'remove' ? '❌ 削除' : '🔄 完全置換'}
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-500">
                                                  {new Date(version.createdAt).toLocaleString('ja-JP')}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => handleRestore(kb, 'usageGuide', version.version)}
                                                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                              >
                                                <RotateCcwIcon className="w-3 h-3" />
                                                <span>復元</span>
                                              </button>
                                            </div>
                                            {version.feedback && (
                                              <p className="text-gray-700 dark:text-gray-400 mb-2 italic">
                                                「{version.feedback}」
                                              </p>
                                            )}
                                            <details className="text-gray-600 dark:text-gray-400">
                                              <summary className="cursor-pointer hover:text-green-600">内容を表示</summary>
                                              <p className="mt-1 whitespace-pre-wrap">{version.content}</p>
                                            </details>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {feedbackKbId === kb.id && feedbackContentType === 'usageGuide' ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-semibold text-green-800 dark:text-green-400">
                                        フィードバックのタイプ:
                                      </label>
                                      <select
                                        value={feedbackMode}
                                        onChange={(e) => setFeedbackMode(e.target.value as 'add' | 'modify' | 'remove')}
                                        className="text-xs border border-green-300 dark:border-green-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                                      >
                                        <option value="add">✅ 追加（既存を保持して新しい活用例を追加）</option>
                                        <option value="modify">✏️ 修正（特定の活用例を改善）</option>
                                        <option value="remove">❌ 削除（不要な活用例を削除）</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-2 text-xs text-green-800 dark:text-green-400">
                                        <input
                                          type="checkbox"
                                          checked={isEditOnly}
                                          onChange={(e) => setIsEditOnly(e.target.checked)}
                                          className="w-4 h-4 text-green-600 focus:ring-green-500"
                                        />
                                        <span>📝 このスキルは編集時のみ使用（インタビュー質問生成では使用しない）</span>
                                      </label>
                                    </div>
                                    <textarea
                                      value={feedback}
                                      onChange={(e) => setFeedback(e.target.value)}
                                      rows={3}
                                      placeholder={
                                        feedbackMode === 'add' 
                                          ? '追加したい活用シーンを入力（例：営業シーンでの活用例も）' 
                                          : feedbackMode === 'modify' 
                                          ? '修正したい部分を指定（例：質問例をもっと具体的に）' 
                                          : '削除したい部分を指定（例：〇〇の活用例は不要）'
                                      }
                                      className="w-full text-sm text-gray-700 dark:text-gray-300 border border-green-300 dark:border-green-600 rounded p-2 bg-white dark:bg-gray-800"
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRegenerate(kb)}
                                        disabled={regenerating || !feedback.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                                      >
                                        <RefreshCwIcon className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                                        <span>{regenerating ? '再生成中...' : 'フィードバックを元に再生成'}</span>
                                      </button>
                                      <button
                                        onClick={handleFeedbackCancel}
                                        disabled={regenerating}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
                                      >
                                        <XIcon className="w-3 h-3" />
                                        <span>キャンセル</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleFeedbackStart(kb, 'usageGuide')}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 text-xs"
                                  >
                                    <MessageSquareIcon className="w-3 h-3" />
                                    <span>💬 改善提案を追加</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {kb.status === 'failed' && kb.errorMessage && (
                          <p className="text-red-600 dark:text-red-400 mt-2">
                            エラー: {kb.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(kb)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span>削除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

